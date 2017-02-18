const generateSophieBundle = require('./generateSophieBundle.js')
const helpers = require('./helpers.js')

let bundlesLoading = {}

const loadSophieBundle = function(bundleId, type) {

  let id = bundleId + type;

  // we do not want to load the same bundle twice at the same time
  // so if we already have a loading promise for this bundle we return this right away
  if (bundlesLoading.hasOwnProperty(id)) {
    return bundlesLoading[id];
  }

  let generatePromise = generateSophieBundle(bundleId, type)
    .then(bundle => {
      delete bundlesLoading[id];
      return bundle;
    })
  
  bundlesLoading[id] = generatePromise;

  return bundlesLoading[id];
}

module.exports = loadSophieBundle
