const { declareInjections, getOwner } = require('@cardstack/di');
const DAGMap = require('dag-map').default;
const compose = require('koa-compose');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache'
},

class MiddlewareStack {
  constructor() {
    this._lastStack = null;
    this._lastSchema = null;
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
    let owner = getOwner(this);
    for (let name of schema.plugins.listAll('middleware')) {
      let loadPath = schema.plugins.loadPathFor('middleware', name);
      let module = owner.lookup(`middleware:${loadPath}`);
      map.add(name, module, module.before, module.after);
    }
    let stack = [];
    map.each((name, module) => {
      stack.push(module);
    });
    stack = compose(stack.map(module => module.middleware()));
    this._lastStack = stack;
    this._lastSchema = schema;
    return stack;
  }




});
