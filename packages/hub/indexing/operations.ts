import { Document } from 'jsonapi-typescript';
import { todo } from '@cardstack/plugin-utils/todo-any';

const opsPrivate: WeakMap<Operations, PrivateOperations> = new WeakMap();

interface PrivateOperations {
  sourceId: string;
  sourcesUpdate: todo;
  nonce: Number | null;
}

function getPriv(instance: Operations): PrivateOperations {
  // safe because we always populate opsPrivate at construction
  return opsPrivate.get(instance)!;
}

class Operations {
  static create(sourcesUpdate: todo, sourceId: string) {
    return new this(sourcesUpdate, sourceId);
  }

  constructor(sourcesUpdate: todo, sourceId: string) {
    opsPrivate.set(this, {
      sourceId,
      sourcesUpdate,
      nonce: null
    });
  }
  async save(type: string, id: string, doc: Document){
    let { sourceId, sourcesUpdate, nonce } = getPriv(this);
    await sourcesUpdate.add(type, id, doc, sourceId, nonce);
  }
  async delete(type: string, id: string) {
    let { sourcesUpdate } = getPriv(this);
    await sourcesUpdate.delete(type, id);
  }
  async beginReplaceAll() {
    getPriv(this).nonce = Math.floor(Number.MAX_SAFE_INTEGER * Math.random());
  }
  async finishReplaceAll() {
    let { sourcesUpdate, sourceId, nonce } = getPriv(this);
    if (!nonce) {
      throw new Error("tried to finishReplaceAll when there was no beginReplaceAll");
    }
    await sourcesUpdate.deleteAllWithoutNonce(sourceId, nonce);
  }
};

export = Operations;
