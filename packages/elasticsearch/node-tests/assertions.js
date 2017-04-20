const Client = require('@cardstack/elasticsearch/client');
const { branchToIndexName } = require('@cardstack/elasticsearch/client');

module.exports = class ElasticAsserter {
  constructor(){
    this.client = new Client();
  }
  async indices() {
    let i = await this.client.es.indices.get({ index: '_all' });
    return Object.keys(i);
  }
  async contentIndices() {
    let i = await this.client.es.indices.get({ index: `${Client.branchPrefix}_*` });
    return Object.keys(i);
  }
  async aliases() {
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
    return this.client.es.getSource({ index: branchToIndexName(branch), type: 'meta', id: dataSourceId });
  }
  async deleteContentIndices() {
    return this.client.es.indices.delete({ index: `${Client.branchPrefix}_*` });
  }
  async documentContents(branch, type, id) {
    return this.client.es.getSource({ index: branchToIndexName(branch), type, id: `${branch}/${id}` });
  }
  async putDocument(branch, type, id, body) {
    return this.client.es.index({ index: branchToIndexName(branch), type, id: `${branch}/${id}`, body });
  }
};
