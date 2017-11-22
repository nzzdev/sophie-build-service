const path = require('path');

module.exports = [
  {
    plugin: require('./mock/sophie-package-loader-mock/index.js')
  },
  {
    plugin: require('../plugins/sophie-bundle/index.js')
  },
  {
    plugin: require('../plugins/sophie-bundle-css/index.js'),
    options: {
      tmpDir: path.join(__dirname, '/tmp'),
      serverCacheConfig: {
        staleTimeout: 99
      }
    }
  },
]