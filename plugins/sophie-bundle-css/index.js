const fs = require("fs-extra");
const path = require("path");
const Hoek = require("@hapi/hoek");
const Boom = require("@hapi/boom");
const sass = require("sass");
const jsonImporter = require("node-sass-json-importer");
const crypto = require("crypto");

const defaultServerMethodCaching = {
  expiresIn: 48 * 60 * 60 * 1000, // expire after 48 hours
  generateTimeout: 60 * 1000, // 1 minute
};

function compileStyle(package, loadPath, filesToCompile) {
  let compiledStyles = "", fileName;

  while ((fileName = filesToCompile.shift())) {
    // server.log(["debug"], `compiling styles ${fileName} of ${package.name}`);
    let rendered;

    try {
      rendered = sass.renderSync({
        file: path.join(loadPath, fileName),
        includePaths: [
          path.join(loadPath, "sophie_packages"),
        ],
        importer: [jsonImporter()],
        outputStyle: "compressed",
      });
    } catch (error) {
      // server.log(["debug"], error);
      throw new Error(
        `sass compilation error in package
        ${package.name} file ${fileName}: ${error.message}`
      );
    }

    compiledStyles += rendered.css.toString();
    // server.log(["debug"], `compiled styles ${fileName} of ${package.name}`);
  }
  return compiledStyles;
}

module.exports = {
  name: "sophie-bundle-css",
  register: async function (server, options) {
    Hoek.assert(options.tmpDir, "tmpDir is a required option");
    
    server.method(
      "sophie.processPackage",
      async function (package, pathPrefix) {
        // download GitHub repository tarball for this package and save it to 'loadPath'
        const loadPath = path.join(
          pathPrefix,
          package.name,
          package.version || package.branch
        );

        try {
          await server.methods.sophie.loadPackage(package, loadPath);
  
          // if this package has submodules, we need to compile them as well
          let filesToCompile = [];
          if (!package.submodules) {
            // if no submodules are given, we compile all submodules
            // check if there is the scss directory first to not fail if a module has no submodules
            const submodulePath = path.join(
              pathPrefix,
              package.name,
              package.version || package.branch,
              "scss"
            );
            if (fs.existsSync(submodulePath)) {
              const submoduleFiles = fs.readdirSync(submodulePath);
              filesToCompile = submoduleFiles.map((file) => `scss/${file}`);
            } else {
              // this is mostly a fallback for older style sophie modules that just have a main.scss file
              filesToCompile = ["main.scss"];
            }
          } else {
            filesToCompile = package.submodules.map((sm) => `scss/${sm}.scss`);
          }
  
          // compile all sass from this package and its submodules
          return compileStyle(package, loadPath, filesToCompile); 
        } catch (error) {
          // server.log(["debug"], error);
          throw error;
        }
      },
      {
        cache: defaultServerMethodCaching,
        generateKey: (package) => package.name + "/" + package.version,
      }
    )

    server.method(
      "sophie.generateBundle.css",
      async function (bundleId) {
        const packages = server.methods.sophie.bundle.getPackagesFromBundleId(bundleId);
        const packagesHash = crypto
          .createHash("md5")
          .update(bundleId)
          .digest("hex");
        const pathPrefix = path.join(options.tmpDir, packagesHash);
        let compiledStyles = "";

        for (const package of packages) {
          compiledStyles += await server.methods.sophie.processPackage(package, pathPrefix);
        }

        return compiledStyles;
      },
      // {
      //   cache: defaultServerMethodCaching,
      // }
    );
  },
};
