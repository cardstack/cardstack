const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  schemaCache: 'hub:schema-cache',
  pluginLoader: 'hub:plugin-loader'
},

class PluginIndexer {
  async branches() {
    return ['master'];
  }
  async beginUpdate(/* branch */) {
    let schema = await this.schemaCache.schemaForControllingBranch();
    return new Updater(schema.plugins);
  }
});

class Updater {
  constructor(plugins) {
    this.plugins = plugins;
  }

  async schema() {
    return [];
  }

  async updateContent(meta, hints, ops) {
    for (let plugin of this.plugins.describeAll()) {
      await ops.save('plugins', plugin.id, plugin);
      for (let { type, id } of plugin.relationships.features.data) {
        await ops.save(type, id, this.plugins.describeFeature(type, id));
      }
    }
  }

  async read(type, id /*, isSchema */) {
    if (type === 'plugins') {
      return this.plugins.describe(id);
    } else {
      return this.plugins.describeFeature(type, id);
    }
  }
}
