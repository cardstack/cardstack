module.exports = class DataSource {
  constructor(model, plugins) {
    this.id = model.id;
    this.sourceType = model.attributes['source-type'];
    this._writer = null;
    this._params = model.attributes.params;
    this._Writer = plugins.lookup('writers', this.sourceType);
    this._writer = null;
  }
  get writer() {
    if (!this._writer) {
      if (this._Writer) {
        this._writer = new (this._Writer)(this._params);
      }
    }
    return this._writer;
  }
};
