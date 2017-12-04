module.exports = {
  path: '/health',
  method: 'GET',
  options: {
    tags: ['api']
  },
  handler: (request, h) => {
    return 'sophie-build-service is alive';
  }
}
