const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache',
  pluginLoader: 'hub:plugin-loader'
},

class PluginSearcher {
  async get(branch, type, id, next) {
    if (type === 'plugins') {
      return this._getPlugin(id);
    }
    return next();
  }

  async search(branch, query, next) {
    if (!query.filter) {
      return next();
    }
    if (query.filter.type === 'plugins') {
      let plugins = await this.pluginLoader.installedPlugins();
      return {
        data: plugins,
        meta: {
          page: { total: plugins.length }
        }
      };
    }
    if (query.filter.type === 'plugin-features') {
      let features = await this.pluginLoader.installedFeatures();
      return {
        data: features,
        meta: {
          page: { total: features.length }
        }
      };
    }
    return next();
  }

  async _getPlugin(/* id */) {

  }


});
