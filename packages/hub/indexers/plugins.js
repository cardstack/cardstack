const { declareInjections } = require('@cardstack/di');
const { isEqual } = require('lodash');

module.exports = declareInjections({
  pluginLoader: 'hub:plugin-loader'
},

class PluginIndexer {
  async branches() {
    return ['master'];
  }
  async beginUpdate(branch, readOtherIndexers) {
    return new Updater(this.pluginLoader, readOtherIndexers);
  }
});

class Updater {
  constructor(pluginLoader, readOtherIndexers) {
    this.pluginLoader = pluginLoader;
    this.readOtherIndexers = readOtherIndexers;
    this._plugins = null;
  }

  async plugins() {
    if (!this._plugins) {
      let installedPlugins = await this.pluginLoader.installedPlugins();
      let pluginConfigs = (await Promise.all(installedPlugins.map(plugin => this.readOtherIndexers('plugin-configs', plugin.id)))).filter(Boolean);
      this._plugins = await this.pluginLoader.configuredPlugins(pluginConfigs);
    }
    return this._plugins;
  }

  async schema() {
    return [];
  }

  async updateContent(meta, hints, ops) {
    let activePlugins = await this.plugins();
    let plugins = activePlugins.describeAll();
    if (meta && isEqual(meta.plugins, plugins)) {
      return { plugins };
    }
    await ops.beginReplaceAll();
    for (let plugin of plugins) {
      await ops.save('plugins', plugin.id, plugin);
      for (let { type, id } of plugin.relationships.features.data) {
        await ops.save(type, id, activePlugins.describeFeature(type, id));
      }
    }
    await ops.finishReplaceAll();
    return { plugins };
  }

  async read(type, id /*, isSchema */) {
    if (type === 'plugins') {
      return (await this.plugins()).describe(id);
    } else {
      return (await this.plugins()).describeFeature(type, id);
    }
  }
}
