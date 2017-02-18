const Hoek = require('hoek');
const Boom = require('boom');
const server = require('./server.js');
const routes = require('./routes/routes.js')
const pusage = require('pidusage')

const plugins = [
  {
    register: require('hapi-alive'),
    options: {
      path: '/health',
      tags: ['health', 'monitor'],
      healthCheck: function(server, callback) {
        pusage.stat(process.pid, function(err, stat) {
          var error;
          if (stat.cpu > 90) {
            error = new Boom.internal('load is too high');
          }
          if ((stat.memory / 1000000) > 1000) {
            error = new Boom.internal('memory usage is too high');
          }
          callback(error);
        })
      }
    }
  }
];

server.register(plugins, err => {
  Hoek.assert(!err, err);

  server.route(routes);

  server.start(err => {
    Hoek.assert(!err, err);
    console.log('Server running at: ' + server.info.uri);
  })
});
