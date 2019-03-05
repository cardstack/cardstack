module.exports = class PendingChange {
  constructor({
    originalDocument,
    finalDocument,
    finalizer,
    aborter,
    searchers,
    branch,
    sourceId,
    schema
  }) {
    if (!branch || !searchers || !schema) {
      throw new Error(`PendingChange requires 'branch', 'searchers', and 'schema' arguments.`);
    }

    this.originalDocument = originalDocument;
    this.finalDocument = finalDocument;
    this.serverProvidedValues = new Map();
    this._finalizer = finalizer;
    this._aborter = aborter;

    if (branch && schema && searchers) {
      if (originalDocument) {
        this.originalDocumentContext = searchers.createDocumentContext({
          type: originalDocument.type,
          branch,
          schema,
          sourceId,
          id: originalDocument.id,
          upstreamDoc: originalDocument ? { data: originalDocument } : null
        });
      }
      if (finalDocument) {
        this.finalDocumentContext = searchers.createDocumentContext({
          type: finalDocument.type,
          branch,
          schema,
          sourceId,
          id: finalDocument.id,
          upstreamDoc: finalDocument ? { data: finalDocument } : null
        });
      }
    }
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