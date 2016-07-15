"use strict"

const stream = require('stream')

const AWS = require('aws-sdk')
const AWS_ENDPOINT = require('../resources/aws-endpoint.js')
const S3_CREDENTIALS = require('../resources/s3-credentials.js')

const generateSophieBundle = require('./generateSophieBundle.js')
const persistSophieBundle = require('./persistSophieBundle.js')
const helpers = require('./helpers.js')

let bundlesLoading = {}

function loadPersistedBundle(bundleId, type) {
  let s3Options = {
    endpoint: AWS_ENDPOINT,
  }

  Object.assign(s3Options, S3_CREDENTIALS);
  let s3obj = new AWS.S3(s3Options);

  return new Promise((resolve, reject) => {
    const req = s3obj.getObject({
      Bucket: 'sophie',
      Key: type + '/' + bundleId
    })

    let passthrough = new stream.PassThrough();

    req.on('error', (err) => reject(err));
    req.on('httpData', (chunk) => passthrough.write(chunk));
    req.on('httpDone', () => passthrough.end());

    req.on('httpHeaders', (statusCode, headers) => {
      if (statusCode >= 400) {
        return reject(statusCode);
      }

      let lm;
      if (headers['date'] && headers['last-modified']) {
        lm = new Date(headers['last-modified'])
      }

      return resolve({
        styles: passthrough,
        lastModified: lm
      });
    });

    req.send();
  })
}

const loadSophieBundle = function(packages, type) {

  let bundleId = helpers.getBundleIdFromPackages(packages);

  let id = bundleId + type;

  // we do not want to load the same bundle twice at the same time
  // so if we already have a loading promise for this bundle we return this right away
  if (bundlesLoading.hasOwnProperty(id)) {
    return bundlesLoading[id];
  }

  bundlesLoading[id] = new Promise((resolve, reject) => {
    loadPersistedBundle(bundleId, type)
      .then(bundle => {
        resolve({
          styles: bundle.styles,
          lastModified: bundle.lastModified
        })
        delete bundlesLoading[id]
      })
      .catch(statusCode => {
        generateSophieBundle(bundleId, type)
          .then(styles => {
            resolve({
              styles: styles
            })
            delete bundlesLoading[id]
            persistSophieBundle(bundleId, type, styles)
          })
          .catch((e) => {
            reject(e)
          })
      })
  })

  return bundlesLoading[id];
}

module.exports = loadSophieBundle
