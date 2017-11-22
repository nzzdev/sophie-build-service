const fs = require('fs-extra');
const path = require('path');
const Hoek = require('hoek');
const Boom = require('boom');
const sass = require('node-sass');

const defaultServerMethodCaching = {
  expiresIn: 48 * 60 * 60 * 1000, // expire after 48 hours
  staleIn: 1 * 60 * 15 * 1000, // rebuild bundles every 15 minutes on request
  staleTimeout: 1, // do not wait before returning a stale bundle
  generateTimeout: 30 * 60 * 1000 // 30 minutes
}

module.exports = {
  name: 'sophie-bundle-css',
  register: async function(server, options) {

    Hoek.assert(options.tmpDir, 'tmpDir is a required option');

    // $lab:coverage:off$
    const cacheConfig = Hoek.applyToDefaults(defaultServerMethodCaching, options.serverCacheConfig || {});
    // $lab:coverage:on$

    server.method('sophie.generateBundle.css', async function(bundleId) {
      const packages = server.methods.sophie.bundle.getPackagesFromBundleId(bundleId);

      await server.methods.sophie.loadPackages(packages, path.join(options.tmpDir, bundleId));
      server.log(['debug'], `got all packages ready at ${options.tmpDir}`);

      let compiledStyles = '';
      for (const pack of packages) {
        const packageInfo = JSON.parse(fs.readFileSync(path.join(options.tmpDir, bundleId, pack.name, pack.version, 'package.json')));
        const sophiePackageInfo = packageInfo.sophie || {};
  
        let filesToCompile = [];
        if (!pack.submodules) {
          filesToCompile.push(sophiePackageInfo.mainCss || 'main.scss');
        } else {
          filesToCompile = filesToCompile.concat(pack.submodules.map(sm => `scss/${sm}.scss`));
        }
  
        let fileName;
        while(fileName = filesToCompile.shift()) {
          server.log(['debug'], `compiling styles ${fileName} of ${pack.name}`);
          let rendered;
          try {
            rendered = sass.renderSync({
              file: path.join(options.tmpDir, bundleId, pack.name, pack.version, fileName),
              includePaths: [path.join(options.tmpDir, bundleId, pack.name, pack.version, 'sophie_packages')],
              outputStyle: 'compressed'
            });
          } catch (err) {
            throw Boom.badImplementation(`sass compilation error in package ${pack.name}@${pack.version} file ${fileName}: ${err.message}`);
          }
  
          const styles = rendered.css.toString()
          server.log(['debug'], `compiled styles ${fileName} of ${pack.name}`);
          compiledStyles += styles;
        }
      }
  
      return compiledStyles;
    }, {
      cache: cacheConfig
    });
  }
}
