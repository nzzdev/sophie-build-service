const Boom = require("@hapi/boom");

module.exports = {
  name: "sophie-bundle",
  register: async function(server, options) {
    // this keepes promises of loading bundles to return straight away if the same bundle is already loading
    const bundlesLoading = {};
    server.method("sophie.bundle.load", function(bundleId, type) {
      const id = bundleId + type;

      // we do not want to load the same bundle twice at the same time
      // so if we already have a loading promise for this bundle we return this right away
      if (bundlesLoading.hasOwnProperty(id)) {
        server.log(
          ["debug", "sophie-bundle"],
          "returning existing bundle loading promise"
        );
        return bundlesLoading[id];
      }

      if (!server.methods.sophie.generateBundle[type]) {
        throw Boom.notImplemented(
          `no generator for bundle type ${type} implemented`
        );
      }

      const generatePromise = server.methods.sophie.generateBundle[type](
        bundleId,
        type
      ).then(bundle => {
        delete bundlesLoading[id];
        return bundle;
      });
      bundlesLoading[id] = generatePromise;
      return generatePromise;
    });

    server.method("sophie.bundle.getPackagesFromBundleId", function(bundleId) {
      return bundleId.split(",").map(p => {
        let submodules;
        if (p.split("[")[0] !== p) {
          submodules = p.split("[")[1].replace("]", "");
        }
        const sophiePackage = {};
        if (p.includes("@")) {
          sophiePackage.name = p.split("[")[0].split("@")[0];
          sophiePackage.version = p.split("[")[0].split("@")[1];
        } else if (p.includes("#")) {
          sophiePackage.name = p.split("[")[0].split("#")[0];
          sophiePackage.branch = p.split("[")[0].split("#")[1];
        } else if (p.includes("%23")) {
          sophiePackage.name = p.split("[")[0].split("%23")[0];
          sophiePackage.branch = p.split("[")[0].split("%23")[1];
        }
        sophiePackage.submodules =
          typeof submodules === "string" ? submodules.split("+") : undefined;
        return sophiePackage;
      });
    });

    // this is not actually used anywhere, but we keep it around anyway
    server.method("sophie.bundle.getBundleIdFromPackages", function(packages) {
      return packages
        .map(p => {
          let bundleIdPart = p.name;
          if (p.version) {
            bundleIdPart += "@" + p.version;
          } else if (p.branch) {
            bundleIdPart += "#" + p.branch;
          }
          if (p.submodules) {
            bundleIdPart += "[" + p.submodules.join("+") + "]";
          }
          return bundleIdPart;
        })
        .join(",");
    });
  }
};
