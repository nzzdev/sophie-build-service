const Hapi = require("@hapi/hapi");

const cacheConfig = {
  provider: {
    constructor: require("@hapi/catbox-memory"),
    options: {
      maxByteSize: 1000000000 // ~ 1GB
    }
  }
};

function getServerWithoutAppConfig() {
  let server = Hapi.server({
    port: process.env.PORT || 3000,
    cache: [cacheConfig],
    routes: {
      cors: true
    }
  });
  return server;
}

function getServerWithEmptyAppConfig() {
  let server = Hapi.server({
    port: process.env.PORT || 3001,
    cache: [cacheConfig],
    routes: {
      cors: true
    },
    app: {}
  });
  return server;
}

function getServerWithCacheControl() {
  let server = Hapi.server({
    port: process.env.PORT || 3002,
    cache: [cacheConfig],
    routes: {
      cors: true
    },
    app: {
      cacheControl:
        "public, max-age=43200, stale-while-revalidate=648000, stale-if-error=648000, s-maxage=3600"
    }
  });
  return server;
}

module.exports = {
  getServerWithoutAppConfig,
  getServerWithEmptyAppConfig,
  getServerWithCacheControl
};
