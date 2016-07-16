'use strict';

const schedule = require('node-schedule');
const hapi = require('hapi');
const boom = require('boom');

const loadSophieBundle = require('./lib/loadSophieBundle.js')
const revalidateBundles = require('./lib/revalidateBundles.js')
const helpers = require('./lib/helpers.js')

const server = new hapi.Server();
server.connection({
  port: process.env.PORT || 3000,
  routes: {
    cors: true
  }
});

server.route({
  method: ['GET', 'OPTIONS'],
  path: '/bundle/{bundleId}.css',
  handler: function(request, reply) {

    const packages = helpers.getPackagesFromBundleId(request.params.bundleId);

    loadSophieBundle(packages, 'css')
      .then(bundle => {
        const response = reply(bundle.styles)

        response
          .type('text/css')
          .ttl(24 * 60 * 60 * 1000)

        if (bundle.lastModified) {
          response.header('Last-Modified', bundle.lastModified.toUTCString())
        }

      })
      .catch(err => {
        const error = boom.create(500);
        error.reformat();
        reply(error);
      })

  }
});

server.start((err) => {
  if (err) {
    throw err;
  }
  console.log('Server running at:', server.info.uri);
});

var rebuildBundlesJob = schedule.scheduleJob('0 */2 * * *', function() {
  console.log('revalidateBundles');
  revalidateBundles();
});
