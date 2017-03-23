const makeClient = require('@cardstack/elasticsearch/client');
const { branchToIndexName } = require('@cardstack/elasticsearch/searcher');

module.exports = class ElasticAsserter {
  constructor(){
    this.client = makeClient();
  }
  async indices() {
    let i = await this.client.indices.get({ index: '_all' });
    return Object.keys(i);
  }
  async contentIndices() {
    let i = await this.client.indices.get({ index: 'content_*' });
    return Object.keys(i);
  }
  async aliases() {
    let output = new Map();
    let i = await this.client.indices.getAlias({ index: '_all' });
    for (let index of Object.keys(i)) {
      for (let alias of Object.keys(i[index].aliases)) {
        output.set(alias, index);
      }
    }
    return output;
  }
  async contentAliases() {
    let output = new Map();
    let i = await this.client.indices.getAlias({ index: 'content_*' });
    for (let index of Object.keys(i)) {
      for (let alias of Object.keys(i[index].aliases)) {
        output.set(alias.replace(/^content_/, ''), index.replace(/^content_/, ''));
      }
    }
    return output;
  }
  async indexerState(branch, repoPath) {
    return this.client.getSource({ index: branchToIndexName(branch), type: 'meta', id: `git/${repoPath}` });
  }
  async deleteAllIndices() {
    return this.client.indices.delete({ index: '_all' });
  }
  async documentContents(branch, type, id) {
    return this.client.getSource({ index: branchToIndexName(branch), type, id });
  }
  async putDocument(branch, type, id, body) {
    return this.client.index({ index: branchToIndexName(branch), type, id, body });
  }
};
