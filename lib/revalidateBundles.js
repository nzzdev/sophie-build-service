'use strict';

const AWS = require('aws-sdk')
const AWS_ENDPOINT = require('../resources/aws-endpoint.js')
const S3_CREDENTIALS = require('../resources/s3-credentials.js')

const generateSophieBundle = require('./generateSophieBundle.js')
const persistSophieBundle = require('./persistSophieBundle.js')

var s3Options = {
  endpoint: AWS_ENDPOINT,
}

Object.assign(s3Options, S3_CREDENTIALS);
var s3obj = new AWS.S3(s3Options);

var params = {
  Bucket: 'sophie',
  EncodingType: 'url',
  FetchOwner: false,
  MaxKeys: 1000,
};

function revalidateBundle(bundleId, type) {
  return generateSophieBundle(bundleId, type)
    .then(styles => {
      return persistSophieBundle(bundleId, type, styles)
    })
}

function revalidateStorageObjectsRecursive(contents, index) {
  if (!contents[index]) {
    return
  }
  let bundle = contents[index]
  if (bundle.Key.indexOf('/') === -1) {
    return;
  }

  let d = new Date();
  let lm = new Date(bundle.LastModified);

  // if this bundle was stored more than 3 hours ago, we reject it
  if (d.getTime() - lm.getTime() > (1000 * 60 * 60 * 3)) {
    console.log(type, 'bundle old', bundleId)
    let type = bundle.Key.split('/')[0]
    let bundleId = bundle.Key.split('/')[1]

    revalidateBundle(bundleId, type)
      .then(() => {
        revalidateStorageObjectsRecursive(contents, index + 1)
      })

  } else {
    console.log(type, 'bundle still fresh', bundleId)
    revalidateStorageObjectsRecursive(contents, index + 1)
  }

}

module.exports = function revalidateBundles() {
  s3obj.listObjectsV2(params, function(err, data) {
    if (err) {
      console.log('err', err, err.stack); // an error occurred
      return;
    }
    if (data.Contents && data.Contents.length) {
      revalidateStorageObjectsRecursive(data.Contents, 0)
    }
  });
}
