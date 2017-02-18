const getPackagesFromBundleId = function(bundleId) {
  return bundleId.split(',')
    .map(p => {
      let submodules;
      if (p.split('[')[0] !== p) {
        submodules = p.split('[')[1].replace(']','');
      }
      return {
        name: p.split('[')[0].split('@')[0],
        version: p.split('[')[0].split('@')[1],
        submodules: typeof submodules === 'string' ? submodules.split('+') : undefined
      }
    })
}

const getBundleIdFromPackages = function(packages) {
  return packages.map(p => {
    let bundleIdPart = p.name + '@' + p.version
    if (p.submodules) {
      bundleIdPart += '[' + p.submodules.join('+') + ']'
    }
    return bundleIdPart
  }).join(',')
}

module.exports = {
  getPackagesFromBundleId: getPackagesFromBundleId,
  getBundleIdFromPackages: getBundleIdFromPackages
}
