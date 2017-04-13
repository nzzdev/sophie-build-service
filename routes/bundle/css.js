const server = require('../../server');
const Boom = require('boom');
const debug = require('debug')('sophie');

const helpers = require('../../lib/helpers.js');
const loadSophieBundle = require('../../lib/loadSophieBundle');

const getSophieCssBundle = function(bundleId, next) {
  loadSophieBundle(bundleId, 'css')
    .then(bundle => {
      next(null, bundle);
    })
    .catch(err => {
      if (err.isBoom) {
        debug(`failed to load bundle (error isBoom): ${bundleId}`);
        next(err, null);
      } else {
        debug(`failed to load bundle: ${bundleId} ${err}`);
        next(Boom.internal(err), null);
      }
    })
};

server.method('getSophieCssBundle', getSophieCssBundle, {
  cache: {
    expiresIn: 48 * 60 * 60 * 1000, // expire after 48 hours
    staleIn: 1 * 60 * 15 * 1000, // rebuild bundles every 15 minutes on request
    staleTimeout: 1, // do not wait before returning a stale bundle
    generateTimeout: 30 * 60 * 1000 // 30 minutes
  }
});

module.exports = [
  {
    method: ['GET', 'OPTIONS'],
    path: '/bundle/{bundleId}.css',
    config: {
      cache: {
        expiresIn: 12 * 60 * 60 * 1000
      }
    },
    handler: function(request, reply) {
      request.server.methods.getSophieCssBundle(request.params.bundleId, (err, styles) => {
        if (err) {
          debug(`failed to load bundle: ${request.params.bundleId}`);
          return reply(err);
        }
        reply(styles).type('text/css');
      })

    }
  }
]
