const fs = require("fs-extra");
const path = require("path");
const Hoek = require("hoek");
const crypto = require("crypto");

const defaultServerMethodCaching = {
  expiresIn: 48 * 60 * 60 * 1000, // expire after 48 hours
  staleIn: 1 * 60 * 5 * 1000, // rebuild bundles every 5 minutes on request
  staleTimeout: 1, // do not wait before returning a stale bundle
  generateTimeout: 60 * 1000 // 1 minute
};

module.exports = {
  name: "sophie-bundle-vars-json",
  register: async function(server, options) {
    Hoek.assert(options.tmpDir, "tmpDir is a required option");

    // $lab:coverage:off$
    const cacheConfig = Hoek.applyToDefaults(
      defaultServerMethodCaching,
      options.serverCacheConfig || {}
    );
    // $lab:coverage:on$

    server.method(
      "sophie.generateBundle.vars_json",
      async function(bundleId) {
        const packages = server.methods.sophie.bundle.getPackagesFromBundleId(
          bundleId
        );
        const packagesHash = crypto
          .createHash("md5")
          .update(bundleId)
          .digest("hex");
        const pathPrefix = path.join(options.tmpDir, packagesHash);

        await server.methods.sophie.loadPackages(packages, pathPrefix);
        server.log(["debug"], `got all packages ready at ${options.tmpDir}`);

        const compiledVars = {};
        for (const pack of packages) {
          compiledVars[pack.name] = {};

          const packageInfo = JSON.parse(
            fs.readFileSync(
              path.join(
                pathPrefix,
                pack.name,
                pack.version || pack.branch,
                "package.json"
              )
            )
          );
          const sophiePackageInfo = packageInfo.sophie || {};

          let filesToCompile = [];
          if (!pack.submodules) {
            // if no submodules are given, we compile all submodules
            // check if there is the scss directory first to not fail if a module has no submodules
            const submoduleVarsPath = path.join(
              pathPrefix,
              pack.name,
              pack.version || pack.branch,
              "vars"
            );
            if (fs.existsSync(submoduleVarsPath)) {
              const submoduleVarFiles = fs.readdirSync(submoduleVarsPath);
              filesToCompile = submoduleVarFiles.map(file => `vars/${file}`);
            } else {
              // this is mostly a fallback for older style sophie modules that just have a main.scss file
              filesToCompile = ["vars.json"];
            }
          } else {
            filesToCompile = pack.submodules.map(sm => `vars/${sm}.json`);
          }

          let fileName;
          while ((fileName = filesToCompile.shift())) {
            compiledVars[pack.name][
              fileName.replace("vars/", "").replace(".json", "")
            ] = require(path.join(
              pathPrefix,
              pack.name,
              pack.version || pack.branch,
              fileName
            ));
          }
        }

        return JSON.stringify(compiledVars);
      },
      {
        cache: cacheConfig
      }
    );
  }
};
