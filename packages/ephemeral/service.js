const Error = require('@cardstack/plugin-utils/error');
const { INTERNAL_PRIVLEGED } = require('@cardstack/plugin-utils/session');
const log = require('@cardstack/plugin-utils/logger')('ephemeral');
const { declareInjections } = require('@cardstack/di');

// When we first load, we establish an identity. This allows us to
// distinguish any older content leftover in the search index from our
// own content.
const identity = Math.random();

// Within our own identity, we track generations to know what to update.
let generationCounter = 0;


module.exports = declareInjections({
  indexers: 'hub:indexers',
  writers: 'hub:writers'
}, class EphemeralStorageService {
  constructor() {
    this._dataSources = new Map();
  }
  async storageForDataSource(id, initialModels) {
    let storage = this._dataSources.get(id);
    if (!storage) {
      storage = new EphemeralStorage(this.indexers);
      this._dataSources.set(id, storage);

      if (initialModels) {
        for (let model of initialModels) {
          // recursion notice: these writes will be coming back to us,
          // meaning they will also call storageForDataSource.
          await this.writers.create('master', INTERNAL_PRIVLEGED, model.type, model);
        }
      }

    }
    return storage;
  }
});


class EphemeralStorage {
  constructor(indexers) {
    // map from `${type}/${id}` to { model, isSchema, generation, type, id }
    // if model == null, that's a tombstone
    this.models = new Map();
    this.indexers = indexers;

    // The special checkpoint "empty" is always available
    this.checkpoints = new Map([['empty', new Map()]]);
  }

  get identity() {
    return identity;
  }

  schemaModels() {
    return [...this.models.values()].filter(entry => entry.isSchema).map(entry => entry.model).filter(Boolean);
  }

  modelsNewerThan(generation) {
    if (generation == null) {
      generation = -Infinity;
    }
    return [...this.models.values()].filter(entry => entry.generation > generation);
  }

  lookup(type, id) {
    let entry = this.models.get(`${type}/${id}`);
    if (entry) {
      return entry.model;
    }
  }

  store(type, id, model, isSchema, ifMatch) {
    generationCounter++;
    let key = `${type}/${id}`;
    let entry = this.models.get(key);

    if (entry && ifMatch != null && String(entry.generation) !== String(ifMatch)) {
      throw new Error("Merge conflict", {
        status: 409,
        source: model ? { pointer: '/data/meta/version'} : { header: 'If-Match' }
      });
    }

    log.debug('storing %s %s, alreadyExisted=%s, deleting=%s', type, id, !!entry, !model);
    this.models.set(key, {
      model,
      isSchema,
      generation: generationCounter,
      type,
      id
    });

    return generationCounter;
  }

  currentGeneration() {
    return generationCounter;
  }

  makeCheckpoint(id) {
    this.checkpoints.set(id, copyMap(this.models));
    log.debug(`created checkpoint ${id}`);
    return ++generationCounter;
  }

  async restoreCheckpoint(id) {
    generationCounter++;
    let checkpoint = this.checkpoints.get(id);
    if (!checkpoint) {
      throw new Error("No such checkpoint", {
        status: 400,
        source: { pointer: '/data/relationships/checkpoint'}
      });
    }

    log.debug(`restoring checkpoint ${id}`);

    for (let [key, value] of checkpoint.entries()) {
      let updatedValue = Object.assign({}, value, { generation: generationCounter });
      this.models.set(key, updatedValue);
    }

    for (let key of this.models.keys()) {
      let entry = this.models.get(key);
      if (entry.generation < generationCounter) {
        this.models.set(key, Object.assign({}, entry, {
          model: null,
          generation: generationCounter
        }));
      }
    }



    await this.indexers.update({ realTime: true });
    log.debug(`restored checkpoint ${id}`);
    return generationCounter;
  }

}

function copyMap(m) {
  let copy = new Map();
  for (let [key, value] of m.entries()) {
    copy.set(key, value);
  }
  return copy;
}
