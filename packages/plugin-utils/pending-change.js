module.exports = class PendingChange {
  constructor(originalDocument, finalDocument, finalizer, aborter) {
    this.originalDocument = originalDocument;
    this.finalDocument = finalDocument;
    this.serverProvidedValues = new Map();
    this._finalizer = finalizer;
    this._aborter = aborter;
  }
  async finalize() {
    let finalizer = this._finalizer;
    this._finalizer = null;
    this._aborter = null;
    if (finalizer) {
      return finalizer.call(null, this);
    }
  }
  async abort() {
    let aborter = this._aborter;
    this._finalizer = null;
    this._aborter = null;
    if (aborter) {
      return aborter.call(null, this);
    }
  }
};
