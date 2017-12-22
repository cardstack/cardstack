const compose = require('koa-compose');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  service: `plugin-services:${require.resolve('./service')}`
},

// This is just a no-op middleware whose sole purpose is
// to start socket.io on cardstack hub server startup.
class LiveQueryMiddleware {
  middleware() { return compose([]); }
});
