const fs = require("fs-extra");
const path = require("path");
const Hoek = require("@hapi/hoek");
const sass = require("sass");
const jsonImporter = require("node-sass-json-importer");
const crypto = require("crypto");

const defaultServerMethodCaching = {
  expiresIn: 7 * 24 * 60 * 60 * 1000, // expire after 7 days
  generateTimeout: 60 * 1000, // 1 minute
};

function compileStyle(loadPath, filesToCompile) {
  let file, compiledStyles = [];

  while ((file = filesToCompile.shift())) {
    let rendered;

    try {
      rendered = sass.renderSync({
        file: path.join(loadPath, file),
        includePaths: [
          path.join(loadPath, "sophie_packages"),
        ],
        importer: [jsonImporter()],
        outputStyle: "compressed",
      });
    } catch (error) {
      // server.log(["debug"], error);
      throw new Error(
        `sass compilation error in file ${file}: ${error.message}`
      );
    }

    compiledStyles.push({
      file: file,
      style: rendered.css.toString(),
    });
  }

  return compiledStyles;
}

module.exports = {
  name: "sophie-bundle-css",
  register: async function (server, options) {
    Hoek.assert(options.tmpDir, "tmpDir is a required option");
    
    server.method(
      "sophie.css.processPackage",
      async function (package, pathPrefix) {
        const loadPath = path.join(
          pathPrefix,
          package.name,
          package.version || package.branch
        );
        const submodulePath = path.join(loadPath, "scss");
        let filesToCompile = [];

        try {
          // download GitHub repository tarball for this package and save it to 'loadPath'  
          await server.methods.sophie.loadPackage(package, loadPath);

          // check if there is the scss directory first to not fail if a module has no submodules
          if (fs.existsSync(submodulePath)) {
            const submoduleFiles = fs.readdirSync(submodulePath);
            filesToCompile = submoduleFiles.map((file) => `scss/${file}`);
          } else {
            // this is mostly a fallback for older style sophie modules that just have a main.scss file
            filesToCompile = ["main.scss"];
          }
  
          // compile all sass from this package and its submodules
          return compileStyle(loadPath, filesToCompile);
        } catch (error) {
          // server.log(["debug"], error);
          throw error;
        }
      },
      {
        cache: defaultServerMethodCaching,
        generateKey: (package) => package.name + "@" + (package.version || package.branch) + ".css",
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
        let compiledStyles = "", compiledPackageStyles = [];

        for (const package of packages) {
          compiledPackageStyles = await server.methods.sophie.css.processPackage(package, pathPrefix);

          if (package.submodules) {
            compiledStyles += compiledPackageStyles
              .filter((submodule) => package.submodules.map((submoduleName) => `scss/${submoduleName}.scss`).includes(submodule.file))
              .map((submodule) => submodule.style);
          } else {
            // if no submodules are given, we compile all submodules
            compiledStyles += compiledPackageStyles
              .map((submodule) => submodule.style);
          }
        }
        return compiledStyles;
      },
      // {
      //   cache: defaultServerMethodCaching,
      // }
    );
  },
};
