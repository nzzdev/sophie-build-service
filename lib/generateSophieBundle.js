const fs = require('fs-extra');
const path = require('path');
const sass = require('node-sass');
const debug = require('debug')('sophie');

const loadSophiePackage = require('./loadSophiePackage.js');
const helpers = require('./helpers.js');

const tmpDir = path.join(__dirname, '../tmp');

packageLoadingPromises = {};

module.exports = async function generateSophieBundle(bundleId, type) {
  let packages = helpers.getPackagesFromBundleId(bundleId)
  let packageDownloadPromises = [];
  for (let pack of packages) {
    let loadPath = path.join(tmpDir, bundleId, pack.name, pack.version);
    if (!packageLoadingPromises.hasOwnProperty(loadPath)) {
      packageLoadingPromises[loadPath] = loadSophiePackage(pack, loadPath);
    }
    let loaded = packageLoadingPromises[loadPath]
      .then(async pack => {
        debug('pack loaded: ' + pack.name);
        let packageInfo = JSON.parse(fs.readFileSync(path.join(tmpDir, bundleId, pack.name, pack.version, 'package.json')));
        if (packageInfo.sophie && packageInfo.sophie.dependencies) {
          let loadDependenciesPromises = []
          for (let dependencyPackageName in packageInfo.sophie.dependencies) {
            let loadDepPromise = loadSophiePackage(
              {
                name: dependencyPackageName,
                version: packageInfo.sophie.dependencies[dependencyPackageName]
              },
              path.join(tmpDir, bundleId, pack.name, pack.version, 'sophie_packages', dependencyPackageName)
            )

            loadDependenciesPromises.push(loadDepPromise)
          }
          await Promise.all(loadDependenciesPromises);
          return pack;
        } else {
          return pack
        }
      })

    packageDownloadPromises.push(loaded);
  }

  await Promise.all(packageDownloadPromises);
  debug('got all packages ready');

  if (type === 'css') {
    let compiledStyles = ''
    for (let pack of packages) {
      let packageInfo = JSON.parse(fs.readFileSync(path.join(tmpDir, bundleId, pack.name, pack.version, 'package.json')))
      let sophiePackageInfo = packageInfo.sophie || {}

      let filesToCompile = [];
      if (!pack.submodules) {
        filesToCompile.push(sophiePackageInfo.mainCss || 'main.scss');
      } else {
        filesToCompile = filesToCompile.concat(pack.submodules.map(sm => `scss/${sm}.scss`))
      }

      let fileName;
      while(fileName = filesToCompile.pop()) {
        debug(`compiling styles ${fileName} of ${pack.name}`);
        let rendered = sass.renderSync({
          file: path.join(tmpDir, bundleId, pack.name, pack.version, fileName),
          includePaths: [path.join(tmpDir, bundleId, pack.name, pack.version, 'sophie_packages')],
          outputStyle: 'compressed'
        })

        let styles = rendered.css.toString()
        if (styles) {
          debug(`compiled styles ${fileName} of ${pack.name}`);
          compiledStyles += styles
        } else {
          debug(`failed to compile styles ${fileName} of ${pack.name}`);
          throw(rendered)
        }
      }
    }

    return compiledStyles
  }
}
