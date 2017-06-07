const Error = require('@cardstack/plugin-utils/error');

module.exports = class DataSource {
  constructor(model, plugins) {
    this.id = model.id;
    this.sourceType = model.attributes['source-type'];
    this._writer = null;
    this._params = Object.assign({dataSourceId: model.id}, model.attributes.params);
    this._Writer = plugins.lookupFeature('writers', this.sourceType);
    this._writer = null;
    this._Indexer = plugins.lookupFeature('indexers', this.sourceType);
    this._indexer = null;
    this._Searcher = plugins.lookupFeatureFactory('searchers', this.sourceType);
    this._searcher = null;
    if (!this._Writer && !this._Indexer && !this._Searcher) {
      throw new Error(`${this.sourceType} does not appear to be a valid data source plugin, because it has no indexer, writer, or searcher`);
    }
  }
  get writer() {
    if (!this._writer && this._Writer) {
      this._writer = new (this._Writer)(this._params);
    }
    return this._writer;
  }
  get indexer() {
    if (!this._indexer && this._Indexer) {
      this._indexer = new (this._Indexer)(this._params);
    }
    return this._indexer;
  }
  get searcher() {
    if (!this._searcher && this._Searcher) {
      this._searcher = this._Searcher.create(this._params);
    }
    return this._searcher;
  }

};
