const { declareInjections } = require('@cardstack/di');
const DAGMap = require('dag-map').default;
const compose = require('koa-compose');
const logger = require('heimdalljs-logger');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache'
},

class MiddlewareStack {
  constructor() {
    this._lastStack = null;
    this._lastSchema = null;
    this.log = logger('middleware-stack');
  }

  middleware() {
    return async (ctxt, next) => {
      let stack = await this._middlewarePlugins();
      await stack(ctxt, next);
    };
  }

  async _middlewarePlugins() {
    let schema = await this.schemaCache.schemaForControllingBranch();
    if (schema === this._lastSchema) {
      return this._lastStack;
    }
    let map = new DAGMap;
    for (let name of schema.plugins.listAll('middleware')) {
      let module = schema.plugins.lookupFeatureAndAssert('middleware', name);
      let before = asArray(module.before).map(tag => `before:${tag}`).concat(
        asArray(module.category).map(tag => `after:${tag}`)
      );
      let after = asArray(module.after).map(tag => `after:${tag}`).concat(
        asArray(module.category).map(tag => `before:${tag}`)
      );
      map.add(name, module, before, after);
    }
    let stack = [];
    this.log.info("Updated middleware plugins:");
    map.each((name, module) => {
      if (module) {
        this.log.info(name);
        stack.push(module);
      } else {
        this.log.info(` --- ${name} ---`);
      }
    });
    stack = compose(stack.map(module => module.middleware()));
    this._lastStack = stack;
    this._lastSchema = schema;
    return stack;
  }




});

function asArray(anything) {
  if (!anything) { return []; }
  if (Array.isArray(anything)) { return anything; }
  return [ anything ];
}
