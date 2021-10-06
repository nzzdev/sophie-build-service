const Hapi = require("@hapi/hapi");
const routes = require("./routes/routes.js");
const path = require("path");

const cacheControl = [
  "public",
  `max-age=${process.env.CACHE_CONTROL_MAX_AGE || 43200}`, // 12 hours
  `stale-while-revalidate=${
    process.env.CACHE_CONTROL_STALE_WHILE_REVALIDATE || 604800
  }`, // 7 days
  `stale-if-error=${process.env.CACHE_CONTROL_STALE_IF_ERROR || 604800}`, // 7 days
  `s-maxage=${process.env.CACHE_CONTROL_S_MAXAGE || 300}`, // 5 minutes
];

async function start() {
  const server = Hapi.server({
    port: process.env.PORT || 3000,
    cache: [
      {
        provider: {
          constructor: require("@hapi/catbox-memory"),
          options: {
            maxByteSize: 1000000000, // ~ 1GB
          },
        },
      },
    ],
    routes: {
      cors: true,
      files: {
        relativeTo: path.join(__dirname, "public"),
      },
      state: { parse: false, failAction: "log" },
    },
    app: {
      cacheControl: cacheControl.join(", "),
    },
  });

  await server.register(require("@hapi/inert"));

  await server.register({
    plugin: require("./plugins/sophie-package-loader-github/index.js"),
    options: {
      githubUserName: process.env.GITHUB_USER_NAME,
      githubAuthToken: process.env.GITHUB_AUTH_TOKEN,
    },
  });

  await server.register({
    plugin: require("./plugins/sophie-bundle/index.js"),
  });

  await server.register({
    plugin: require("./plugins/sophie-bundle-css/index.js"),
    options: {
      tmpDir: path.join(__dirname, "/tmp"),
    },
  });

  await server.register({
    plugin: require("./plugins/sophie-bundle-vars-json/index.js"),
    options: {
      tmpDir: path.join(__dirname, "/tmp"),
    },
  });

  await server.register({
    plugin: require("hapi-pino"),
    options: {
      redact: ["req.headers.authorization", "req.headers.cookie"],
      prettyPrint:
        process.env.APP_ENV !== "production" &&
        process.env.APP_ENV !== "staging" &&
        process.env.APP_ENV !== "test",
      logRouteTags: true,
      // This is required otherwise the request object will be logged twice
      // See https://github.com/pinojs/hapi-pino/pull/92 for more details
      getChildBindings: () => ({}),
      ignorePaths: ["/health"],
    },
  });

  server.route(routes);

  server.route({
    method: "GET",
    path: "/{param*}",
    handler: {
      directory: {
        path: ".",
        redirectToSlash: true,
        index: true,
      },
    },
  });

  await server.start();

  console.log("server running", server.info.uri);
}

start();
