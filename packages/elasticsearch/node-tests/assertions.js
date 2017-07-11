const Client = require('../client');

module.exports = class ElasticAsserter {
  constructor(){
    this.client = null;
  }
  async _ensureClient() {
    if (!this.client) {
      this.client = await Client.create();
    }
  }
  async indices() {
    await this._ensureClient();
    let i = await this.client.es.indices.get({ index: '_all' });
    return Object.keys(i);
  }
  async contentIndices() {
    await this._ensureClient();
    let i = await this.client.es.indices.get({ index: `${Client.branchPrefix}_*` });
    return Object.keys(i);
  }
  async aliases() {
    await this._ensureClient();
    let output = new Map();
    let i = await this.client.es.indices.getAlias({ index: '_all' });
    for (let index of Object.keys(i)) {
      for (let alias of Object.keys(i[index].aliases)) {
        output.set(alias, index);
      }
    }
    return output;
  }
  async contentAliases() {
    await this._ensureClient();
    let output = new Map();
    let i = await this.client.es.indices.getAlias({ index: `${Client.branchPrefix}_*` });
    for (let index of Object.keys(i)) {
      for (let alias of Object.keys(i[index].aliases)) {
        let pattern = new RegExp('^' + Client.branchPrefix + '_');
        output.set(alias.replace(pattern, ''), index.replace(pattern, ''));
      }
    }
    return output;
  }
  async indexerState(branch, dataSourceId) {
    await this._ensureClient();
    return this.client.es.getSource({ index: Client.branchToIndexName(branch), type: 'meta', id: dataSourceId });
  }
  async deleteContentIndices() {
    await this._ensureClient();
    return this.client.es.indices.delete({ index: `${Client.branchPrefix}_*` });
  }
  async documentContents(branch, type, id) {
    await this._ensureClient();
    return this.client.es.getSource({ index: Client.branchToIndexName(branch), type, id: `${branch}/${id}` });
  }
  async putDocument(branch, type, id, body) {
    await this._ensureClient();
    return this.client.es.index({ index: Client.branchToIndexName(branch), type, id: `${branch}/${id}`, body });
  }
};
