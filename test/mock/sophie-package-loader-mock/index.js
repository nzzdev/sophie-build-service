const Boom = require('boom');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  name: 'sophie-package-loader-mock',
  register: async function(server, options) {

    server.method('sophie.loadPackage', async function(pack, savePath) {
      try {
        await fs.emptyDir(savePath);
        await fs.copy(`${__dirname}/../sophie-modules/${pack.name}`, savePath);
      } catch (err) {
        if (err.code === "ENOENT") {
          throw Boom.notFound('At least one requested module could not be found');
        }
        throw err;
      }

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