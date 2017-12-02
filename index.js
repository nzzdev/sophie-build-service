const Hoek = require('hoek');
const Boom = require('boom');
const Hapi = require('hapi');
const routes = require('./routes/routes.js')
const path = require('path');

async function start() {
  const server = Hapi.server({
    port: process.env.PORT || 3000,
    cache: [
      {
        engine: require('catbox-memory'),
        options: {
          maxByteSize: 1000000000, // ~ 1GB
        }
      },
    ],
    routes: {
      cors: true,
      files: {
        relativeTo: path.join(__dirname, 'public')
      }
    }
  });

  const cacheControl = [
    'public',
    `max-age=${process.env.CACHE_CONTROL_MAX_AGE || 43200}`,
    `max-age=${process.env.CACHE_CONTROL_STALE_WHILE_REVALIDATE || 648000}`,
    `max-age=${process.env.CACHE_CONTROL_STALE_IF_ERROR || 648000}`,
    `max-age=${process.env.CACHE_CONTROL_S_MAXAGE || 360}`
  ]

  server.app = {
    cacheControl: cacheControl.join(', ')
  };

  await server.register(require('inert'));

  await server.register({
    plugin: require('./plugins/sophie-package-loader-github/index.js'),
    options: {
      githubUserName: process.env.GITHUB_USER_NAME,
      githubAuthToken: process.env.GITHUB_AUTH_TOKEN
    }
  });

  await server.register({
    plugin: require('./plugins/sophie-bundle/index.js')
  });

  await server.register({
    plugin: require('./plugins/sophie-bundle-css/index.js'),
    options: {
      tmpDir: path.join(__dirname, '/tmp')
    }
  });

  await server.register({
    plugin: require('hapi-pino'),
    options: {
      prettyPrint: process.env.APP_ENV !== 'production' && process.env.APP_ENV !== 'staging',
      ignorePaths: [
        '/health'
      ]
    }
  });

  server.route(routes);

  server.route({
    method: 'GET',
    path: '/{param*}',
    handler: {
      directory: {
        path: '.',
        redirectToSlash: true,
        index: true,
      }
    }
  });

  await server.start();

  console.log('server running', server.info.uri);
}

start();
