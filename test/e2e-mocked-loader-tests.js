const Lab = require("@hapi/lab");
const Code = require("@hapi/code");
const lab = (exports.lab = Lab.script());

const expect = Code.expect;
const before = lab.before;
const after = lab.after;
const it = lab.it;

let server = require("./server.js").getServer();
let serverWithCacheControl = require("./server.js").getServerWithCacheControl();
const plugins = require("./plugins.js");
const routes = require("../routes/routes.js");

before(async () => {
  try {
    await server.register(plugins);
    await serverWithCacheControl.register(plugins);
    server.route(routes);
    serverWithCacheControl.route(routes);

    await server.route({
      method: "GET",
      path: "/bundle/{bundleId}.inexistingtype",
      handler: async function(request, h) {
        return await request.server.methods.sophie.bundle.load(
          request.params.bundleId,
          "inexistingtype"
        );
      }
    });
    await server.start();
    await serverWithCacheControl.start();
  } catch (err) {
    expect(err).to.not.exist();
  }
});

after(async () => {
  await server.stop({ timeout: 2000 });
  server = null;
});

lab.experiment("basics", () => {
  it("starts the server", () => {
    expect(server.info.created).to.be.a.number();
  });

  it("is healthy", async () => {
    const response = await server.inject("/health");
    expect(response.payload).to.equal("sophie-build-service is alive");
  });
});

lab.experiment("bundle css", () => {
  it("returns a compiled bundle for a package without dependencies", async () => {
    const response = await server.inject("/bundle/test-module3%23master.css");
    expect(response.statusCode).to.be.equal(200);
    expect(response.result).to.be.equal(".test-module3{color:green}\n");
  });

  it("returns a compiled bundle for a package with dependencies", async () => {
    const response = await server.inject("/bundle/test-module1@^1.css");
    expect(response.statusCode).to.be.equal(200);
    expect(response.result).to.be.equal(
      '.test-module1{color:#000;background-color:"red"}\n'
    );
  });

  it("returns a compiled bundle for a package with submodules defined", async () => {
    const response = await server.inject("/bundle/test-module2@^1[bar].css");
    expect(response.statusCode).to.be.equal(200);
    expect(response.result).to.be.equal('.test-module2__bar{color:"red"}\n');
  });

  it("returns a compiled bundle for a package with multiple submodules defined", async () => {
    const response = await server.inject(
      "/bundle/test-module2%23master[bar+baz].css"
    );
    expect(response.statusCode).to.be.equal(200);
    expect(response.result).to.be.equal(
      '.test-module2__bar{color:"red"}\n.test-module2__baz{color:"red"}\n'
    );
  });

  it("returns a compiled bundle for a package with no sophie configuration in package.json", async () => {
    const response = await server.inject("/bundle/test-module3@^1.css");
    expect(response.statusCode).to.be.equal(200);
    expect(response.result).to.be.equal(".test-module3{color:green}\n");
  });

  it("returns a 500 error if a bundle fails to compile", async () => {
    const response = await server.inject("/bundle/test-module4@^1.css");
    expect(response.statusCode).to.be.equal(500);
  });

  it("returns a 404 error if an unexisting bundle is requests", async () => {
    const response = await server.inject("/bundle/inexisting-module@^1.css");
    expect(response.statusCode).to.be.equal(404);
    expect(response.result.message).to.be.equal(
      "At least one requested module could not be found"
    );
  });

  it(
    "generates a bundle only once if requested again during generation time",
    { plan: 5 },
    async () => {
      let existingBundleLoadingPromiseReturned = false;
      function listenForServerEvents(event, tags) {
        if (tags["sophie-bundle"] === true) {
          expect(existingBundleLoadingPromiseReturned).to.be.false();
          expect(event.data).to.be.equal(
            "returning existing bundle loading promise"
          );
          existingBundleLoadingPromiseReturned = true;
        }
      }
      server.events.on("log", listenForServerEvents);
      const response1Promise = server.inject("/bundle/test-module1@^1.css");
      const response2Promise = server.inject("/bundle/test-module1@^1.css");

      const responses = await Promise.all([response1Promise, response2Promise]);
      expect(responses[0].result).to.be.equal(
        '.test-module1{color:#000;background-color:"red"}\n'
      );
      expect(responses[1].result).to.be.equal(
        '.test-module1{color:#000;background-color:"red"}\n'
      );

      expect(existingBundleLoadingPromiseReturned).to.be.true();
      server.events.removeListener("log", listenForServerEvents);
    }
  );

  it("returns an error if no generator server method is defined for given bundle type", async () => {
    const response = await server.inject(
      "/bundle/test-module@^1.inexistingtype"
    );
    expect(response.statusCode).to.be.equal(501);
    expect(response.result.message).to.be.equal(
      "no generator for bundle type inexistingtype implemented"
    );
  });
});

lab.experiment("bundle vars json", () => {
  it("returns a compiled vars json bundle for a package with submodules defined", async () => {
    const response = await server.inject(
      "/bundle/test-module1@^1[main].vars.json"
    );
    expect(response.statusCode).to.be.equal(200);
    expect(response.result).to.be.equal(
      '{"test-module1":{"main":{"test-color-primary-1":"#000"}}}'
    );
  });

  it("returns a compiled vars json bundle for a package with no sophie configuration in package.json", async () => {
    const response = await server.inject(
      "/bundle/test-module3%23master.vars.json"
    );
    expect(response.statusCode).to.be.equal(200);
    expect(response.result).to.be.equal(
      '{"test-module3":{"vars":{"test-color-primary-3":"green"}}}'
    );
  });

  it("returns a 404 error if an unexisting vars bundle is requests", async () => {
    const response = await server.inject(
      "/bundle/inexisting-module@^1.vars.json"
    );
    expect(response.statusCode).to.be.equal(404);
    expect(response.result.message).to.be.equal(
      "At least one requested module could not be found"
    );
  });
});

lab.experiment("server config", () => {
  it("returns Cache-Control: no-cache if no cache config given", async () => {
    const response = await server.inject("/bundle/test-module2@^1.css");
    expect(response.headers["cache-control"]).to.be.equal("no-cache");
  });

  it("returns configured cache-control headers if given", async () => {
    const response = await serverWithCacheControl.inject(
      "/bundle/test-module2@^1.css"
    );
    expect(response.headers["cache-control"]).to.be.equal(
      "public, max-age=43200, stale-while-revalidate=648000, stale-if-error=648000, s-maxage=3600"
    );
  });

  it("returns Cache-Control: no-cache if no cache config given", async () => {
    const response = await server.inject("/bundle/test-module1@^1.vars.json");
    expect(response.headers["cache-control"]).to.be.equal("no-cache");
  });

  it("returns configured cache-control headers if given", async () => {
    const response = await serverWithCacheControl.inject(
      "/bundle/test-module1@^1.vars.json"
    );
    expect(response.headers["cache-control"]).to.be.equal(
      "public, max-age=43200, stale-while-revalidate=648000, stale-if-error=648000, s-maxage=3600"
    );
  });
});
