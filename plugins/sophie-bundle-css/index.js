const fs = require('fs-extra');
const path = require('path');
const Hoek = require('hoek');
const Boom = require('boom');
const sass = require('node-sass');
const jsonImporter = require('node-sass-json-importer');

const defaultServerMethodCaching = {
  expiresIn: 48 * 60 * 60 * 1000, // expire after 48 hours
  staleIn: 1 * 60 * 5 * 1000, // rebuild bundles every 5 minutes on request
  staleTimeout: 1, // do not wait before returning a stale bundle
  generateTimeout: 60 * 1000 // 1 minute
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
          // if no submodules are given, we compile all submodules
          // check if there is the scss directory first to not fail if a module has no submodules
          const submodulePath = path.join(options.tmpDir, bundleId, pack.name, pack.version, 'scss');
          if (fs.existsSync(submodulePath)) {
            const submoduleFiles = fs.readdirSync(submodulePath);
            filesToCompile = submoduleFiles.map(file => `scss/${file}`);
          } else {
            // this is mostly a fallback for older style sophie modules that just have a main.scss file
            filesToCompile = ['main.scss'];
          }
        } else {
          filesToCompile = pack.submodules.map(sm => `scss/${sm}.scss`);
        }
  
        let fileName;
        while(fileName = filesToCompile.shift()) {
          server.log(['debug'], `compiling styles ${fileName} of ${pack.name}`);
          let rendered;
          try {
            rendered = sass.renderSync({
              file: path.join(options.tmpDir, bundleId, pack.name, pack.version, fileName),
              includePaths: [path.join(options.tmpDir, bundleId, pack.name, pack.version, 'sophie_packages')],
              importer: [jsonImporter],
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
