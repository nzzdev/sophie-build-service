const AWS = require('aws-sdk');
const DYNSTRG = require('./dynstrg-info.js');

module.exports = new AWS.Endpoint(DYNSTRG.credentials.accessHost);
