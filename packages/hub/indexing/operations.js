const opsPrivate = new WeakMap();

module.exports = class Operations {
  static create(branchUpdate, sourceId) {
    return new this(branchUpdate, sourceId);
  }

  constructor(branchUpdate, sourceId) {
    opsPrivate.set(this, {
      sourceId,
      branchUpdate,
      nonce: null
    });
  }
  async save(type, id, doc){
    let { sourceId, branchUpdate, nonce } = opsPrivate.get(this);
    await branchUpdate.add(type, id, doc, sourceId, nonce);
  }
  async delete(type, id) {
    let { branchUpdate } = opsPrivate.get(this);
    await branchUpdate.delete(type, id);
  }
  async beginReplaceAll() {
    opsPrivate.get(this).nonce = Math.floor(Number.MAX_SAFE_INTEGER * Math.random());
  }
  async finishReplaceAll() {
    let { branchUpdate, sourceId, nonce } = opsPrivate.get(this);
    if (!nonce) {
      throw new Error("tried to finishReplaceAll when there was no beginReplaceAll");
    }
    await branchUpdate.deleteAllWithoutNonce(sourceId, nonce);
  }
};
