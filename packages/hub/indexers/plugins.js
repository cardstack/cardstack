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
    return new Updater();
  }
});

class Updater {
  async schema() {
    return [];
  }

  async updateContent(meta, hints, ops) {

  }

  async read(type, id /*, isSchema */) {
  }
}
