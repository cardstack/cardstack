const { declareInjections } = require('@cardstack/di');
const { isEqual } = require('lodash');

module.exports = declareInjections(
  {
    pluginLoader: 'hub:plugin-loader',
  },

  class PluginIndexer {
    async beginUpdate() {
      return new Updater(this.pluginLoader);
    }
  }
);

class Updater {
  constructor(pluginLoader) {
    this.pluginLoader = pluginLoader;
    this._plugins = null;
  }

  async plugins() {
    if (!this._plugins) {
      this._plugins = await this.pluginLoader.installedPlugins();
    }
    return this._plugins;
  }

  async features() {
    if (!this._features) {
      this._features = await this.pluginLoader.installedFeatures();
    }
    return this._features;
  }

  async schema() {
    return [];
  }

  async updateContent(meta, hints, ops) {
    let plugins = await this.plugins();
    let features = await this.features();
    if (meta && isEqual(meta.plugins, plugins)) {
      return { plugins };
    }
    await ops.beginReplaceAll();
    for (let plugin of plugins) {
      await ops.save('plugins', plugin.id, { data: plugin });
    }
    for (let feature of features) {
      await ops.save(feature.type, feature.id, { data: feature });
    }
    await ops.finishReplaceAll();
    return { plugins };
  }
}
