const { declareInjections } = require('@cardstack/di');
const DAGMap = require('dag-map').default;
const compose = require('koa-compose');
const log = require('@cardstack/logger')('cardstack/middleware-stack');

module.exports = declareInjections({
  plugins: 'hub:plugins'
},

class MiddlewareStack {
  constructor() {
    this._lastStack = [];
    this._lastHandler = null;
    this._lastActivePlugins = null;
  }

  middleware() {
    return async (ctxt, next) => {
      let stack = await this._middlewarePlugins();
      await stack(ctxt, next);
    };
  }

  async _middlewarePlugins() {
    let activePlugins = await this.plugins.active();
    if (activePlugins === this._lastActivePlugins) {
      return this._lastHandler;
    }
    let map = new DAGMap;


    let tags = new Map();
    for (let feature of activePlugins.featuresOfType('middleware')) {
      let module = activePlugins.lookupFeatureAndAssert('middleware', feature.id);

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
    log.info("Updated middleware plugins:");
    map.each((name, module) => {
      if (module) {
        log.info(name);
        stack.push(module);
      } else {
        log.info(` --- ${name} ---`);
      }
    });
    
    for (let middleware of this._lastStack) {
      if (typeof middleware.teardown === 'function') {
        await middleware.teardown();
      }
    }
    this._lastStack = stack;
    let handler = compose(stack.map(module => module.middleware()));
    this._lastHandler = handler;
    this._lastActivePlugins = activePlugins;
    return handler;
  }




});

function asArray(anything) {
  if (!anything) { return []; }
  if (Array.isArray(anything)) { return anything; }
  return [ anything ];
}
