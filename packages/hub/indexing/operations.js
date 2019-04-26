const opsPrivate = new WeakMap();

module.exports = class Operations {
  static create(sourcesUpdate, sourceId) {
    return new this(sourcesUpdate, sourceId);
  }

  constructor(sourcesUpdate, sourceId) {
    opsPrivate.set(this, {
      sourceId,
      sourcesUpdate,
      nonce: null
    });
  }
  async save(type, id, doc){
    let { sourceId, sourcesUpdate, nonce } = opsPrivate.get(this);
    await sourcesUpdate.add(type, id, doc, sourceId, nonce);
  }
  async delete(type, id) {
    let { sourcesUpdate } = opsPrivate.get(this);
    await sourcesUpdate.delete(type, id);
  }
  async beginReplaceAll() {
    opsPrivate.get(this).nonce = Math.floor(Number.MAX_SAFE_INTEGER * Math.random());
  }
  async finishReplaceAll() {
    let { sourcesUpdate, sourceId, nonce } = opsPrivate.get(this);
    if (!nonce) {
      throw new Error("tried to finishReplaceAll when there was no beginReplaceAll");
    }
    await sourcesUpdate.deleteAllWithoutNonce(sourceId, nonce);
  }
};
