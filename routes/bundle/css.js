module.exports = [
  {
    method: ["GET", "OPTIONS"],
    path: "/bundle/{bundleId}.css",
    handler: async function(request, h) {
      let styles;
      try {
        styles = await request.server.methods.sophie.bundle.load(
          request.params.bundleId,
          "css"
        );
      } catch (err) {
        request.server.log(["error"], err.message);
        throw err;
      }

      const response = h.response(styles).type("text/css");

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
