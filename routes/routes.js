let routes = [
  require('./health.js')
]
.concat(require('./bundle/css.js'))
.concat(require('./bundle/vars-json.js'))
module.exports = routes;
