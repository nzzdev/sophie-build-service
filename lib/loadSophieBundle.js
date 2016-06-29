"use strict"
const fs = require('fs-extra')
const path = require('path')
const sass = require('node-sass')
const GitHub = require('github-api');
const gh = new GitHub({
   username: process.env.GITHUB_USER_NAME,
   password: process.env.GITHUB_AUTH_TOKEN
});

const tmpDir = path.join(__dirname, '../tmp');

const loadSophiePackage = require('./loadSophiePackage.js')

const bundlesLoading = {};

const loadSophieBundle = function(packages) {

  let bundleId = packages.map(p => {
    return p.name + p.version
  }).join('')

  if (bundlesLoading.hasOwnProperty(bundleId)) {
    return bundlesLoading[bundleId];
  }

  let packageDownloadPromises = []
  for (let pack of packages) {
    console.log(path.join(tmpDir, bundleId, pack.name, pack.version))
    let loadPackage = loadSophiePackage(gh, pack, path.join(tmpDir, bundleId, pack.name, pack.version))
      .then(pack => {
        let packageInfo = JSON.parse(fs.readFileSync(path.join(tmpDir, bundleId, pack.name, pack.version, 'package.json')));
        if (packageInfo.sophie && packageInfo.sophie.dependencies) {
          let loadDependenciesPromises = []
          for (let dependencyPackageName in packageInfo.sophie.dependencies) {
            let loadDepPromise = loadSophiePackage(
              gh,
              {
                name: dependencyPackageName,
                version: packageInfo.sophie.dependencies[dependencyPackageName]
              },
              path.join(tmpDir, bundleId, pack.name, pack.version, 'sophie_packages', dependencyPackageName)
            )

            loadDependenciesPromises.push(loadDepPromise)
          }
          return Promise.all(loadDependenciesPromises)
            .then(() => {
              return pack
            })
        } else {
          return pack
        }
      })
      .catch(err => {
        console.log('err', err)
      })

    packageDownloadPromises.push(loadPackage)
  }

  bundlesLoading[bundleId] = Promise.all(packageDownloadPromises)
    .then(packages => {
      let compiledStyles = ''
      for (let pack of packages) {
        let packageInfo = JSON.parse(fs.readFileSync(path.join(tmpDir, bundleId, pack.name, pack.version, 'package.json')))
        let sophiePackageInfo = packageInfo.sophie || {}

        let rendered = sass.renderSync({
          file: path.join(tmpDir, bundleId, pack.name, pack.version, sophiePackageInfo.mainCss || 'main.scss'),
          includePaths: [path.join(tmpDir, bundleId, pack.name, pack.version, 'sophie_packages')]
        })

        let styles = rendered.css.toString()
        if (styles) {
          compiledStyles += styles
        } else {
          throw(rendered)
        }
      }
      fs.emptyDirSync(path.join(tmpDir, bundleId));
      delete bundlesLoading[bundleId]
      return compiledStyles
    })

    return bundlesLoading[bundleId]
}

module.exports = loadSophieBundle
