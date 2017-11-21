const fs = require('fs-extra');
const path = require('path');
const btoa = require('btoa');
const tar = require('tar');
const zlib = require('zlib');
const semver = require('semver');
const fetch = require('node-fetch');

function getSatisfyingRelease(releases, version) {
  for (let release of releases) {
    if (semver.satisfies(release.tag_name, version)) {
      return release;
    }
  }
  return undefined;
}

module.exports = {
  name: 'sophie-package-loader-github',
  register: async function(server, options) {

    const GitHub = require('github-api');
    const gh = new GitHub({
       username: options.githubUserName,
       password: options.githubAuthToken
    });

    server.method('sophie.loadPackage', async function(pack, savePath) {
      server.log(['debug'], `loading package ${pack.name}`);
      const repo = gh.getRepo('nzzdev', pack.name);

      const releases = await repo.listReleases();

      // find the satisfying release
      const satisfyingRelease = getSatisfyingRelease(releases.data, pack.version);
      if (!satisfyingRelease) {
        throw Boom.badRequest(`no satisfying version found for ${pack.name}@${pack.version}`);
      }

      server.log(['debug'], `found satisfiying release ${pack.name}@${satisfyingRelease.name}`);
      server.log(['debug'], `going to fetch ${satisfyingRelease.tarball_url}`);

      try {

        const response = await fetch(satisfyingRelease.tarball_url, {
          headers: {
            'Authorization': 'Basic ' + btoa(`${process.env.GITHUB_USER_NAME}:${process.env.GITHUB_AUTH_TOKEN}`),
          }
        })

        server.log(['debug'], `loaded release tarball for ${pack.name}`);

        // clear the directory first
        await fs.emptyDir(savePath);

        await new Promise((resolve, reject) => {
          let stream = response.body
            .pipe(zlib.createGunzip())
            .pipe(tar.extract({
              cwd: savePath,
              strip: 1
            }))
            .on('error', err => {
              server.log(['debug'], `failed to extract ${pack.name}: ${err}`)
              reject(err);
            })
            .on('end', () => {
              server.log(['debug'], `extracted ${pack.name}`)
              resolve(pack)
            })
        });

        // if there are any sophie dependencies, load them
        const packageInfo = JSON.parse(fs.readFileSync(path.join(savePath, 'package.json')));
        if (packageInfo.sophie && packageInfo.sophie.dependencies) {
          const loadDependenciesPromises = [];
          for (const dependencyPackageName in packageInfo.sophie.dependencies) {
            const dependencyPackage = {
              name: dependencyPackageName,
              version: packageInfo.sophie.dependencies[dependencyPackageName]
            }
            const dependencyPackageSavePath = path.join(savePath, 'sophie_packages', dependencyPackageName);
            const loadDepPromise = server.methods.sophie.loadPackage(dependencyPackage, dependencyPackageSavePath);
            loadDependenciesPromises.push(loadDepPromise);
          }
          await Promise.all(loadDependenciesPromises);
          return pack;
        } else {
          return pack;
        }
      } catch (err) {
        server.log(['debug'], 'failed to load from github, check if pack exists on disk');
        try {
          if (fs.readdirSync(savePath).length > 1) {
            server.log(['debug'], 'pack exists on disk');
            return pack;
          } else {
            throw new Error(`failed to load package ${pack.name}`);
          }
        } catch (err) {
          server.log(['debug'], 'pack does not exist on disk. this will fail bad');
          throw new Error(`failed to load package ${pack.name}`);
        }
      }
    });

    server.method('sophie.loadPackages', async function(packages, savePath) {
      const loadPromises = [];
      for (let pack of packages) {
        let loadPath = path.join(savePath, pack.name, pack.version);
        let loadPromise = server.methods.sophie.loadPackage(pack, loadPath);
        loadPromises.push(loadPromise);
      }
      return await Promise.all(loadPromises);
    });
  }
}