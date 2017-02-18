const Hapi = require('hapi');

const server = new Hapi.Server({
  cache: [
    {
      engine: require('catbox-memory'),
      options: {
        maxByteSize: 1000000000, // ~ 1GB
      }
    },
  ]
});

server.connection({
  port: process.env.PORT || 3000,
  routes: {
    cors: true
  }
});

module.exports = server;
