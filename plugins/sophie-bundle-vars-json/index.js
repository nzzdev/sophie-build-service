const fs = require("fs-extra");
const path = require("path");
const Hoek = require("@hapi/hoek");
const crypto = require("crypto");

const defaultServerMethodCaching = {
  expiresIn: 7 * 24 * 60 * 60 * 1000, // expire after 7 days
  generateTimeout: 60 * 1000 // 1 minute
};

function compileVars(loadPath, filesToCompile) {
  let file, compiledVars = {};

  while ((file = filesToCompile.shift())) {
    const filePath = path.join(loadPath, file);
    if (!fs.existsSync(filePath)) continue;
    compiledVars[
      file.replace("vars/", "").replace(".json", "")
    ] = require(filePath);
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
        const submoduleVarsPath = path.join(loadPath, "vars");
        let filesToCompile = [];

        try {
          // download GitHub repository tarball for this package and save it to 'loadPath'
          await server.methods.sophie.loadPackage(package, loadPath);
  
          // check if there is the vars directory first to not fail if a module has no submodules
          if (fs.existsSync(submoduleVarsPath)) {
            const submoduleVarFiles = fs.readdirSync(submoduleVarsPath);
            filesToCompile = submoduleVarFiles.map(file => `vars/${file}`);
          } else {
            // this is mostly a fallback for older style sophie modules that just have a vars.json file
            filesToCompile = ["vars.json"];
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
        generateKey: (package) => package.name + "@" + (package.version || package.branch) + ".vars.json",
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
        let compiledVars = {}, compiledVarsPackage = {};

        for (const package of packages) {
          compiledVarsPackage = await server.methods.sophie.vars_json.processPackage(package, pathPrefix);

          if (package.submodules) {
            for (const submoduleName of package.submodules) {
              compiledVars[package.name] = {};
              compiledVars[package.name][submoduleName] = compiledVarsPackage[submoduleName];
            }
          } else {
            // if no submodules are given, we compile all submodules
            compiledVars[package.name] = compiledVarsPackage;
          }
        }
        return JSON.stringify(compiledVars);
      },
      // {
      //   cache: defaultServerMethodCaching
      // }
    );
  }
};
