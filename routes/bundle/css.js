const Boom = require('boom');

module.exports = [
  {
    method: ['GET', 'OPTIONS'],
    path: '/bundle/{bundleId}.css',
    handler: async function(request, h) {
      const styles = await request.server.methods.sophie.generateBundle.css(request.params.bundleId);

      const response = h.response(styles).type('text/css');

      if (request.server.app.cacheControl) {
        response.header('cache-control', request.server.app.cacheControl);
      }

      return response;
    }
  }
];
