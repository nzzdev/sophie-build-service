const Hoek = require('hoek');
const Boom = require('boom');
const Hapi = require('hapi');
const routes = require('./routes/routes.js')
const pusage = require('pidusage');
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
      cors: true
    }
  });

  server.app = {
    cacheControl: 'public, max-age=43200, stale-while-revalidate=648000, stale-if-error=648000, s-maxage=3600'
  };

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

  await server.route(routes);

  await server.start();

  console.log('server running', server.info.uri);
}

start();
