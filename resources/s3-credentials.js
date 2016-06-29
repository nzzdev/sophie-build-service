const DYNSTRG = require('./dynstrg-info.js');

module.exports = {
  accessKeyId: DYNSTRG.credentials.accessKey,
  secretAccessKey: DYNSTRG.credentials.sharedSecret
}
