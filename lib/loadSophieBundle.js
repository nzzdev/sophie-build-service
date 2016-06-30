"use strict"

const stream = require('stream')
const fs = require('fs-extra')
const path = require('path')
const sass = require('node-sass')

const AWS = require('aws-sdk')
const AWS_ENDPOINT = require('../resources/aws-endpoint.js')
const S3_CREDENTIALS = require('../resources/s3-credentials.js')

const tmpDir = path.join(__dirname, '../tmp')

const loadSophiePackage = require('./loadSophiePackage.js')
const persistSophieBundle = require('./persistSophieBundle.js')

let bundlesLoading = {}
let bundlesPersisting = {}

function loadPersistedBundle(name) {
  let s3Options = {
    endpoint: AWS_ENDPOINT,
  }

  Object.assign(s3Options, S3_CREDENTIALS);
  let s3obj = new AWS.S3(s3Options);

  return new Promise((resolve, reject) => {
    const req = s3obj.getObject({
      Bucket: 'sophie',
      Key: name
    })

    let passthrough = new stream.PassThrough();

    req.on('error', (err) => reject(err));
    req.on('httpData', (chunk) => passthrough.write(chunk));
    req.on('httpDone', () => passthrough.end());

    req.on('httpHeaders', (statusCode, headers) => {
      if (statusCode >= 400) {
        return reject(statusCode);
      }

      if (headers['date'] && headers['last-modified']) {
        let d = new Date(headers['date'])
        let lm = new Date(headers['last-modified'])
        if (d.getTime() - lm.getTime() > (1000 * 60 * 60 * 6)) {
          reject()
        }
      }

      return resolve(passthrough);
    });

    req.send();
  })
}

function generateBundle(packages, bundleId) {
  let packageDownloadPromises = []
  for (let pack of packages) {
    let loadPackage = loadSophiePackage(pack, path.join(tmpDir, bundleId, pack.name, pack.version))
      .then(pack => {
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

  return Promise.all(packageDownloadPromises)
    .then(packages => {
      let compiledStyles = ''
      for (let pack of packages) {
        let packageInfo = JSON.parse(fs.readFileSync(path.join(tmpDir, bundleId, pack.name, pack.version, 'package.json')))
        let sophiePackageInfo = packageInfo.sophie || {}

        let rendered = sass.renderSync({
          file: path.join(tmpDir, bundleId, pack.name, pack.version, sophiePackageInfo.mainCss || 'main.scss'),
          includePaths: [path.join(tmpDir, bundleId, pack.name, pack.version, 'sophie_packages')],
          outputStyle: 'compressed'
        })

        let styles = rendered.css.toString()
        if (styles) {
          compiledStyles += styles
        } else {
          throw(rendered)
        }
      }

      bundlesPersisting[bundleId] = persistSophieBundle(compiledStyles, bundleId)

      bundlesPersisting[bundleId]
        .then(() => {
          delete bundlesPersisting[bundleId]
        })

      fs.emptyDir(path.join(tmpDir, bundleId), err => {
        if (!err) delete bundlesLoading[bundleId]
      })

      return compiledStyles
    })
}

const loadSophieBundle = function(packages) {

  let bundleId = packages.map(p => {
    return p.name + '@' + p.version
  }).join('')

  if (bundlesLoading.hasOwnProperty(bundleId)) {
    return bundlesLoading[bundleId];
  }

  bundlesLoading[bundleId] = new Promise((resolve, reject) => {
    loadPersistedBundle(bundleId)
      .then(stream => {
        resolve(stream)
        delete bundlesLoading[bundleId]
      })
      .catch(statusCode => {
        generateBundle(packages, bundleId)
          .then(styles => {
            resolve(styles)
            delete bundlesLoading[bundleId]
            persistSophieBundle(bundleId, styles)
          })
      })
  })

  return bundlesLoading[bundleId];
}

module.exports = loadSophieBundle
