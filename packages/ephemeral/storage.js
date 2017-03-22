const pool = new Map();
let generationCounter = 0;

class EphemeralStorage {
  static create(storageKey) {
    if (!pool.has(storageKey)) {
      pool.set(storageKey, new this());
    }
    return pool.get(storageKey);
  }
  constructor() {
    // map from `${type}/${id}` to { model, isSchema, generation, type, id }
    // if model == null, that's a tombstone
    this.models = new Map();
  }

  schemaModels() {
    return [...this.models.values()].filter(entry => entry.isSchema).map(entry => entry.model);
  }

  contentModelsNewerThan(generation) {
    if (generation == null) {
      generation = -Infinity;
    }
    return [...this.models.values()].filter(entry => !entry.isSchema && entry.generation > generation);
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

    if (entry && ifMatch != null && entry.generation !== ifMatch) {
      throw new Error("Merge conflict", { status: 409 });
    }

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
}

module.exports = EphemeralStorage;
