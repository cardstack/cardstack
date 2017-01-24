const makeClient = require('../src/elastic-client');

exports.inES = function(host) {
  return new ElasticAsserter(host);
};

class ElasticAsserter {
  constructor(host){
    this.client = makeClient(host);
  }
  async indices() {
    let i = await this.client.indices.get({ index: '_all' });
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
  async deleteAllIndices() {
    return this.client.indices.delete({ index: '_all' });
  }
}
