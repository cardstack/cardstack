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
  async deleteAllIndices() {
    return this.client.indices.delete({ index: '_all' });
  }
}
