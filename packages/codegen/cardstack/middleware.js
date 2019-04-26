const { declareInjections } = require('@cardstack/di');
const route = require('koa-better-route');

module.exports = declareInjections({
  // TODO: the code-generators service really belongs in this package,
  // not the hub. But that depends on refactoring the relationship
  // between hub and ember-cli, which I'm planning to do anyway as
  // part of containerization.
  service: `hub:code-generators`
},

class CodeGenMiddleware {
  constructor() {
    this.before = 'authentication';
  }

  middleware() {
    return route.get('/codegen/:module_prefix', async (ctxt) => {
      ctxt.body = await this.service.generateCode(ctxt.routeParams.module_prefix);
      ctxt.response.set('Access-Control-Allow-Origin', '*');
      ctxt.response.set('Content-Type', 'application/javascript');
      ctxt.status = 200;
    });
  }

});
