const fs = require("fs-extra");
const path = require("path");
const Hoek = require("@hapi/hoek");
const crypto = require("crypto");

const defaultServerMethodCaching = {
  expiresIn: 48 * 60 * 60 * 1000, // expire after 48 hours
  generateTimeout: 60 * 1000 // 1 minute
};

function compileVars(loadPath, filesToCompile) {
  let fileName, compiledVars = {};

  while ((fileName = filesToCompile.shift())) {
    compiledVars[
      fileName.replace("vars/", "").replace(".json", "")
    ] = require(path.join(loadPath, fileName));
  }

  return compiledVars;
}

module.exports = {
  name: "sophie-bundle-vars-json",
  register: async function(server, options) {
    Hoek.assert(options.tmpDir, "tmpDir is a required option");

    server.method(
      "sophie.vars_json.processPackage",
      async function (package, pathPrefix) {
        const loadPath = path.join(
          pathPrefix,
          package.name,
          package.version || package.branch
        );

        try {
          // download GitHub repository tarball for this package and save it to 'loadPath'
          await server.methods.sophie.loadPackage(package, loadPath);
  
          // if this package has submodules, we need to compile them as well
          let filesToCompile = [];
          if (!package.submodules) {
            // if no submodules are given, we compile all submodules
            // check if there is the scss directory first to not fail if a module has no submodules
            const submoduleVarsPath = path.join(loadPath, "vars");
            if (fs.existsSync(submoduleVarsPath)) {
              const submoduleVarFiles = fs.readdirSync(submoduleVarsPath);
              filesToCompile = submoduleVarFiles.map(file => `vars/${file}`);
            } else {
              // this is mostly a fallback for older style sophie modules that just have a main.scss file
              filesToCompile = ["vars.json"];
            }
          } else {
            filesToCompile = package.submodules.map(sm => `vars/${sm}.json`);
          }
  
          // compile all sass from this package and its submodules
          return compileVars(loadPath, filesToCompile); 
        } catch (error) {
          // server.log(["debug"], error);
          throw error;
        }
      },
      {
        cache: defaultServerMethodCaching,
        generateKey: (package) => package.name + "@" + package.version + ".vars.json",
      }
    )

    server.method(
      "sophie.generateBundle.vars_json",
      async function(bundleId) {
        const packages = server.methods.sophie.bundle.getPackagesFromBundleId(bundleId);
        const packagesHash = crypto
          .createHash("md5")
          .update(bundleId)
          .digest("hex");
        const pathPrefix = path.join(options.tmpDir, packagesHash);
        const compiledVars = {};

        for (const package of packages) {
          compiledVars[package.name] = await server.methods.sophie.vars_json.processPackage(package, pathPrefix);
        }

        return JSON.stringify(compiledVars);
      },
      // {
      //   cache: defaultServerMethodCaching
      // }
    );
  }
};
