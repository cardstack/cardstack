module.exports = class Field {
  constructor(model, plugins) {
    this.id = model.id;
    this.sourceType = model.attributes['source-type'];
    this._writer = null;
    this.params = model.attributes.params;
    this._Writer = plugins.writer(this.sourceType);
  }
  get writer() {
    if (!this._writer) {
      if (this._Writer) {
        this._writer = new (this._Writer)(this.params);
      }
    }
    return this._writer;
  }
};
