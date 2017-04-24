module.exports = class DataSource {
  constructor(model, plugins) {
    this.id = model.id;
    this.sourceType = model.attributes['source-type'];
    this._writer = null;
    this._params = model.attributes.params;
    this._Writer = plugins.lookupOptional('writers', this.sourceType);
    this._writer = null;
    this._Indexer = plugins.lookupOptional('indexers', this.sourceType);
    this._indexer = null;
    this._Searcher = plugins.lookupOptional('searchers', this.sourceType);
    this._searcher = null;
  }
  get writer() {
    if (!this._writer && this._Writer) {
      this._writer = new (this._Writer)(this._params, this.id);
    }
    return this._writer;
  }
  get indexer() {
    if (!this._indexer && this._Indexer) {
      this._indexer = new (this._Indexer)(this._params, this.id);
    }
    return this._indexer;
  }
  get searcher() {
    if (!this._searcher && this._Searcher) {
      this._searcher = new (this._Searcher)(this._params, this.id);
    }
    return this._searcher;
  }

};
