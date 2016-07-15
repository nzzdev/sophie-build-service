'use strict';

const AWS = require('aws-sdk');
const AWS_ENDPOINT = require('../resources/aws-endpoint.js');
const S3_CREDENTIALS = require('../resources/s3-credentials.js');

module.exports = function persistSophieBundle(name, type, string) {
  var s3Options = {
    endpoint: AWS_ENDPOINT,
    params: {
      Bucket: 'sophie',
      Key: type + '/' + name
    }
  }

  Object.assign(s3Options, S3_CREDENTIALS);
  var s3obj = new AWS.S3(s3Options);

  return new Promise((resolve, reject) => {
    s3obj.putObject({Body: string})
      .send((err, data) => {
        if (err) {
          console.log('error in persisting', err)
          reject(err);
        } else {
          resolve(data);
        }
      });
  })

}
