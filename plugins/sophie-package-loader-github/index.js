const Boom = require("boom");
const fs = require("fs-extra");
const path = require("path");
const btoa = require("btoa");
const tar = require("tar");
const zlib = require("zlib");
const semver = require("semver");
const fetch = require("node-fetch");

function getSatisfyingRelease(releases, version) {
  for (const release of releases) {
    if (semver.satisfies(release.tag_name, version)) {
      return release;
    }
  }
  return undefined;
}

function getSatisfyingBranch(branches, branch) {
  for (const availableBranch of branches) {
    if (availableBranch.name === branch) {
      return availableBranch;
    }
  }
  return undefined;
}

async function getSatisfyingTarballUrl(gh, pack) {
  const repo = gh.getRepo("nzzdev", pack.name);

  if (pack.version) {
    let releases;
    try {
      releases = await repo.listReleases();
    } catch (err) {
      server.log(["error"], {
        msg: `loading release list from github failed
              for ${pack.name}: ${err.message}`
      });
      if (err.response.status === 404) {
        throw Boom.notFound("At least one requested module could not be found");
      }
      throw Boom.internal();
    }
    const satisfiyingRelease = getSatisfyingRelease(
      releases.data,
      pack.version
    );
    return satisfiyingRelease.tarball_url;
  } else if (pack.branch) {
    const details = await repo.getDetails();
    let branches;
    try {
      branches = await repo.listBranches();
      const satisfiyingBranch = getSatisfyingBranch(branches.data, pack.branch);
      if (satisfiyingBranch) {
        return details.data.archive_url
          .replace("{archive_format}", "tarball")
          .replace("{/ref}", `/${pack.branch}`);
      }
    } catch (err) {
      debugger;
    }
  }
}

module.exports = {
  name: "sophie-package-loader-github",
  register: async function(server, options) {
    const GitHub = require("github-api");
    const gh = new GitHub({
      username: options.githubUserName,
      password: options.githubAuthToken
    });

    server.method("sophie.loadPackage", async function(pack, savePath) {
      server.log(["debug"], { msg: `loading package ${pack.name}` });

      const loadPackageStartTime = Date.now();
      const timingInfo = {};

      // find the satisfying release
      const satisfyingTarballUrl = await getSatisfyingTarballUrl(gh, pack);
      if (!satisfyingTarballUrl) {
        throw Boom.badRequest(
          `no satisfying tarbal found for ${pack.name}
          with version: ${pack.version} 
          and branch: ${pack.branch}`
        );
      }

      timingInfo.satisfyingTarballUrlFound = Date.now() - loadPackageStartTime;

      server.log(["debug"], `found satisfiying tarball for ${pack.name}`);
      server.log(["debug"], `going to fetch ${satisfyingTarballUrl}`);

      try {
        const response = await fetch(satisfyingTarballUrl, {
          headers: {
            Authorization:
              "Basic " +
              btoa(
                `${process.env.GITHUB_USER_NAME}:${
                  process.env.GITHUB_AUTH_TOKEN
                }`
              )
          }
        });

        if (!response.ok) {
          server.log(
            ["error"],
            `failed to load tarball from github for ${pack.name}: ${
              response.statusText
            }`
          );
          throw new Error(
            `failed to load tarball, github responded with ${response.status}`
          );
        }

        server.log(["debug"], `loaded release tarball for ${pack.name}`);

        timingInfo.releaseTarballLoaded = Date.now() - loadPackageStartTime;

        // clear the directory first
        await fs.emptyDir(savePath);

        await new Promise((resolve, reject) => {
          let stream = response.body
            .pipe(zlib.createGunzip())
            .pipe(
              tar.extract({
                cwd: savePath,
                strip: 1
              })
            )
            .on("error", err => {
              server.log(["error"], `failed to extract ${pack.name}: ${err}`);
              reject(err);
            })
            .on("end", () => {
              server.log(["debug"], `extracted ${pack.name}`);
              resolve(pack);
            });
        });

        timingInfo.releaseTarballUnpacked = Date.now() - loadPackageStartTime;

        // if there are any sophie dependencies, load them
        const packageInfo = JSON.parse(
          fs.readFileSync(path.join(savePath, "package.json"))
        );
        if (packageInfo.sophie && packageInfo.sophie.dependencies) {
          const loadDependenciesPromises = [];
          for (const dependencyPackageName in packageInfo.sophie.dependencies) {
            const dependencyPackage = {
              name: dependencyPackageName,
              version: packageInfo.sophie.dependencies[dependencyPackageName]
            };
            const dependencyPackageSavePath = path.join(
              savePath,
              "sophie_packages",
              dependencyPackageName
            );
            const loadDepPromise = server.methods.sophie.loadPackage(
              dependencyPackage,
              dependencyPackageSavePath
            );
            loadDependenciesPromises.push(loadDepPromise);
          }
          await Promise.all(loadDependenciesPromises);

          timingInfo.dependenciesLoaded = Date.now() - loadPackageStartTime;
        }

        timingInfo.loadTime = Date.now() - loadPackageStartTime;

        server.log(["info", process.env.APP_ENV], {
          msg: "sophie package loaded from github",
          satisfyingTarballUrl: satisfyingTarballUrl,
          package: pack,
          timing: timingInfo
        });

        return pack;
      } catch (err) {
        server.log(
          ["info"],
          "failed to load from github, check if pack exists on disk"
        );
        try {
          if (fs.readdirSync(savePath).length > 1) {
            server.log(["debug"], "pack exists on disk");
            return pack;
          } else {
            throw new Error(`failed to load package ${pack.name}`);
          }
        } catch (err) {
          server.log(
            ["error"],
            "pack does not exist on disk. this will fail bad"
          );
          throw new Error(`failed to load package ${pack.name}`);
        }
      }
    });

    server.method("sophie.loadPackages", async function(packages, savePath) {
      const loadPromises = [];
      for (let pack of packages) {
        let loadPath = path.join(
          savePath,
          pack.name,
          pack.version || pack.branch
        );
        let loadPromise = server.methods.sophie.loadPackage(pack, loadPath);
        loadPromises.push(loadPromise);
      }
      return await Promise.all(loadPromises);
    });
  }
};
