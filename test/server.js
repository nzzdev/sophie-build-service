const Hapi = require("@hapi/hapi");

function getServer() {
  let server = Hapi.server({
    port: process.env.PORT || 3000,
    cache: [
      {
        provider: {
          constructor: require("@hapi/catbox-memory"),
          options: {
            maxByteSize: 1000000000 // ~ 1GB
          }
        }
      }
    ],
    routes: {
      cors: true
    }
  });
  return server;
}

function getServerWithCacheControl() {
  let server = Hapi.server({
    port: process.env.PORT || 3001,
    cache: [
      {
        provider: {
          constructor: require("@hapi/catbox-memory"),
          options: {
            maxByteSize: 1000000000 // ~ 1GB
          }
        }
      }
    ],
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

module.exports.getServer = getServer;
module.exports.getServerWithCacheControl = getServerWithCacheControl;
