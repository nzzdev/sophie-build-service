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
        return {
          name: p.split('@')[0],
          version: p.split('@')[1]
        }
      })

    loadSophieBundle(packages)
      .then(styles => {
        reply(styles).type('text/css');
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


