const Hoek = require('hoek');
const Boom = require('boom');
const server = require('./server.js');
const routes = require('./routes/routes.js')
const pusage = require('pidusage')

let goodOptions = {
  reporters: {
    consoleReporter: [
      {
        module: 'good-squeeze',
        name: 'Squeeze',
        args: [
          {
            log: '*',
            response: {
              include: '*',
              exclude: 'health'
            }
          }
        ]
      },
      {
        module: 'good-console',
        args: [{ format: '', utc: false }]
      },
      'stdout'
    ]
  }
}

if (process.env.LOGGLY_TOKEN && process.env.LOGGLY_SUBDOMAIN && process.env.LOGGLY_HOSTNAME) {
  goodOptions.reporters.loggly = [
    {
      module: 'good-squeeze',
      name: 'Squeeze',
      args: [
        {
          log: '*',
          response: {
            include: '*',
            exclude: 'health'
          }
        }
      ]
    },
    {
      module: require('good-loggly'),
      args: [{
        token: process.env.LOGGLY_TOKEN,
        subdomain: process.env.LOGGLY_SUBDOMAIN,
        tags: '*',
        name: 'sophie build service',
        hostname: process.env.LOGGLY_HOSTNAME,
        threshold: 20,
        maxDelay: 15000
      }]
    }
  ]
}

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
  },
  {
    register: require('good'),
    options: goodOptions
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
