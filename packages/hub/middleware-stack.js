const { declareInjections } = require('@cardstack/di');
const DAGMap = require('dag-map').default;
const compose = require('koa-compose');
const logger = require('@cardstack/plugin-utils/logger');

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


    let tags = new Map();
    for (let feature of schema.plugins.featuresOfType('middleware')) {
      let module = schema.plugins.lookupFeatureAndAssert('middleware', feature.id);

      let beforeTags = asArray(module.before);
      let afterTags = asArray(module.after);
      let ownTags = asArray(module.category);

      let before = beforeTags.map(tag => `before:${tag}`).concat(
        ownTags.map(tag => `after:${tag}`)
      );
      let after = afterTags.map(tag => `after:${tag}`).concat(
        ownTags.map(tag => `before:${tag}`)
      );
      map.add(feature.id, module, before, after);

      for (let tag of beforeTags.concat(afterTags).concat(ownTags)) {
        tags.set(tag, true);
      }
    }

    for (let tag of tags.keys()) {
      map.add(`after:${tag}`, null, [], `before:${tag}`);
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
