'use strict';

const hapi = require('hapi')
const boom = require('boom');

const loadSophieBundle = require('./lib/loadSophieBundle.js')

const server = new hapi.Server();
server.connection({
  port: process.env.PORT || 3000,
  routes: {
    cors: true
  }
});

server.route({
  method: ['GET', 'OPTIONS'],
  path: '/bundle/{packages}.css',
  handler: function(request, reply) {

    const packages = request.params.packages.split(',')
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

    loadSophieBundle(packages)
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
        console.log('err', err)
        const error = Boom.create(500);
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


