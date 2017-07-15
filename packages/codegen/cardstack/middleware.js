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
    return route.get('/codegen/:branch', async (ctxt) => {
      let modules = await this.service.generateCodeForBranch(ctxt.routeParams.branch);
      let compiled = await Promise.all([...modules.entries()].map(([moduleName, code]) => this._compileModule(moduleName, code)));
      ctxt.body = this._concatModules(compiled);
      ctxt.response.set('Access-Control-Allow-Origin', '*');
      ctxt.response.set('Content-Type', 'application/javascript');
      ctxt.status = 200;
    });
  }

  async _compileModule(moduleName, code) {
    return code;
  }

  _concatModules(modules) {
    return modules.join("");
  }

});
