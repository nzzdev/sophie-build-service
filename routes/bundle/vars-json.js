module.exports = [
  {
    method: ["GET", "OPTIONS"],
    path: "/bundle/{bundleId}.vars.json",
    handler: async function(request, h) {
      let varsJson;
      try {
        varsJson = await request.server.methods.sophie.bundle.load(
          request.params.bundleId,
          "vars_json"
        );
      } catch (err) {
        request.server.log(["error"], err.message);
        throw err;
      }

      const response = h.response(varsJson).type("text/json");

      if (
        request.server.settings.app &&
        request.server.settings.app.cacheControl
      ) {
        response.header(
          "cache-control",
          request.server.settings.app.cacheControl
        );
      }

      return response;
    }
  }
];
