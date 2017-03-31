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
    let i = await this.client.es.indices.get({ index: 'content_*' });
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
    let i = await this.client.es.indices.getAlias({ index: 'content_*' });
    for (let index of Object.keys(i)) {
      for (let alias of Object.keys(i[index].aliases)) {
        output.set(alias.replace(/^content_/, ''), index.replace(/^content_/, ''));
      }
    }
    return output;
  }
  async indexerState(branch, repoPath) {
    return this.client.es.getSource({ index: branchToIndexName(branch), type: 'meta', id: `git/${repoPath}` });
  }
  async deleteAllIndices() {
    return this.client.es.indices.delete({ index: '_all' });
  }
  async documentContents(branch, type, id) {
    return this.client.es.getSource({ index: branchToIndexName(branch), type, id: `${branch}/${id}` });
  }
  async putDocument(branch, type, id, body) {
    return this.client.es.index({ index: branchToIndexName(branch), type, id: `${branch}/${id}`, body });
  }
};
