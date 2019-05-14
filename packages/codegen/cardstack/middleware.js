const { declareInjections } = require('@cardstack/di');
const route = require('koa-better-route');
const { transform } = require('@babel/core');

module.exports = declareInjections(
  {
    // TODO: the code-generators service really belongs in this package,
    // not the hub. But that depends on refactoring the relationship
    // between hub and ember-cli, which I'm planning to do anyway as
    // part of containerization.
    service: `hub:code-generators`,
  },

  class CodeGenMiddleware {
    constructor() {
      this.before = "authentication";
    }

  middleware() {
    return route.get('/codegen/:module_prefix', async (ctxt) => {
      let { appModules, modules } = await this.service.generateCode();
      let modulePrefix = ctxt.routeParams.module_prefix;
      ctxt.body = compileModules(appModules, modulePrefix) + compileModules(modules);
      ctxt.response.set('Access-Control-Allow-Origin', '*');
      ctxt.response.set('Content-Type', 'application/javascript');
      ctxt.status = 200;
    });
  }

});

function compileModules(modules, packagePrefix=null) {
  let results = [];
  for (let [name, code] of modules) {
    results.push(
      transform(code, {
        plugins: ['@babel/plugin-transform-modules-amd'],
        moduleId: packagePrefix ? `${packagePrefix}/${name}` : name
      }).code
    );
  }
  return results.join("\n");
}
