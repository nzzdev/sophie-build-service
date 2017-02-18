const server = require('../../server');
const Boom = require('boom');

const helpers = require('../../lib/helpers.js');
const loadSophieBundle = require('../../lib/loadSophieBundle');

const getSophieCssBundle = function(bundleId, next) {
  loadSophieBundle(bundleId, 'css')
    .then(bundle => {
      next(null, bundle);
    })
    .catch(err => {
      console.log('ERROR', err)
      if (err.isBoom) {
        next(err, null);
      } else {
        console.log(err)
        next(Boom.internal(err), null);
      }
    })
};  

server.method('getSophieCssBundle', getSophieCssBundle, {
  cache: {
    expiresIn: 48 * 60 * 60 * 1000, // expire after 48 hours
    staleIn: 1 * 60 * 60 * 1000, // rebuild bundles every 1 hour on request
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
          return reply(err);
        }
        reply(styles).type('text/css');
      })

    }
  }
]
