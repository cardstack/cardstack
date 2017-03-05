/*
  Indexer deals with indexing documents. It's public API is just
  `update`, which is responsible for getting any new upstream content
  into the search index.

  update takes these optional arguments:

    - realTime: when true, update will block until the resulting
      changes are visible in elasticsearch. This is somewhat
      expensive, which is why we make it optional. Most of the time
      non-realtime is good enough and much faster. Defaults to false.

    - hints: can contain a list of `{ branch, id, type }`
      references. This is intended as an optimization hint when we
      know that certain resources are the ones that likely need to be
      indexed right away. Indexers are responsible for discovering and
      indexing arbitrary upstream changes regardless of this hint, but
      the hint can make it easier to keep the search index nearly
      real-time fresh.

*/

const logger = require('heimdalljs-logger');
const makeClient = require('@cardstack/elasticsearch/client');
const { isEqual } = require('lodash');
const BulkOps = require('./bulk-ops');
const Schema = require('./schema');

module.exports = class IndexerEngine {
  constructor(indexers, searcher, plugins) {
    this.indexers = indexers;
    this.es = makeClient();
    this.searcher = searcher;
    this.plugins = plugins;
    this.log = logger('indexer-engine');
  }

  async update({ realTime, hints} = {}) {
    let branches = await this._branches(hints);
    await Promise.all(Object.keys(branches).map(
      branchName => this._updateBranch(branchName, branches[branchName], realTime, hints)
    ));
  }

  async _updateBranch(branch, updaters, realTime, hints) {
    let haveMapping = await this._esMapping(branch);
    let partialSchema = await this._updateSchema(branch, updaters, realTime, hints);
    let wantMapping = partialSchema.schema.mapping();
    this.log.debug('%j', { haveMapping, wantMapping });
    if (this._stableMapping(haveMapping, wantMapping)) {
      this.log.info('%s: mapping already OK', branch);
    } else {
      this.log.info('%s: mapping needs update', branch);
      let tmpIndex = this._tempIndexName(branch);
      await this.es.indices.create({
        index: tmpIndex,
        body: {
          mappings: wantMapping
        }
      });
      await this._reindex(tmpIndex, branch);
    }
    await this._updateContent(branch, updaters, realTime, hints, partialSchema);
  }

  async _branches() {
    let branches = {};
    await Promise.all(this.indexers.map(async indexer => {
      for (let branch of await indexer.branches()) {
        if (!branches[branch]) {
          branches[branch] = [];
        }
        let updater = await indexer.beginUpdate(branch);
        if (updater.name == null) {
          throw new Error("index updaters must provide a name");
        }
        branches[branch].push(updater);
      }
    }));
    return branches;
  }

  async _esMapping(branch) {
    let mapping = await this.es.indices.getMapping({ index: branch, ignore: [404] });
    if (mapping.status === 404) {
      return null;
    } else {
      let index = Object.keys(mapping)[0];
      return mapping[index].mappings;
    }
  }

  _tempIndexName(branch) {
    return `${branch}_${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)}`;
  }

  _stableMapping(have, want) {
    if (!have) { return false; }
    // We only check types in "want". Extraneous types in "have" are OK.
    return Object.keys(want).every(
      type => isEqual(have[type], want[type])
    );
  }


  async _loadMeta(branch, updater) {
    return this.es.getSource({
      index: branch,
      type: 'meta',
      id: updater.name,
      ignore: [404]
    });
  }

  async _saveMeta(branch, updater, newMeta, publicOps) {
    let bulkOps = opsPrivate.get(publicOps).bulkOps;
    await bulkOps.add({
      index: {
        _index: branch,
        _type: 'meta',
        _id: updater.name,
      }
    }, newMeta);
    await bulkOps.flush();
  }

  async _updateSchema(branch, updaters, realTime, hints) {
    let toSave = [];
    let models;
    try {
      models = await this.searcher.search(branch, {
        filter: {
          type: Schema.ownTypes()
        }
      });
    } catch (err) {
      if (err.status !== 404) {
        throw err;
      }
      models = [];
    }
    this.log.debug("starting with %s schema models", models.length);

    for (let updater of updaters) {
      let publicOps = new SchemaOperations(this.es, branch, realTime);
      let privateOps = opsPrivate.get(publicOps);
      let meta = await this._loadMeta(branch, updater);
      await updater.updateSchema(meta, hints, publicOps);
      models = privateOps.applyTo(models);
      toSave.push(privateOps);
    }

    return {
      schema: await Schema.loadFrom(models, this.plugins),
      async save() {
        for (let privateOps of toSave) {
          await privateOps.writeOut();
        }
      }
    };
  }

  async _updateContent(branch, updaters, realTime, hints, partialSchema) {
    await partialSchema.save();
    for (let updater of updaters) {
      let publicOps = new PublicOperations(this.es, branch, realTime);
      let meta = await this._loadMeta(branch, updater);
      let newMeta = await updater.updateContent(meta, hints, publicOps);
      await this._saveMeta(branch, updater, newMeta, publicOps);
    }
  }

  // 1. Index the branch into newIndex.
  // 2. Update the canonical elasticsearch alias for the branch to point at newIndex
  // 3. Delete any old index that we just replaced.
  async _reindex(newIndex, branch) {
    let alias = await this.es.indices.getAlias({ name: branch, ignore: [404] });
    if (alias.status === 404) {
      this.log.info('%s is new, nothing to reindex', branch);
    } else {
      this.log.info('reindexing %s', branch);
      await this.es.reindex({
        body: {
          source: { index: branch },
          dest: { index: newIndex }
        }
      });

    }
    await this.es.indices.updateAliases({
      body: {
        actions: [
          { remove: { index: '_all', alias: branch } },
          { add: { index: newIndex, alias: branch } }
        ]
      }
    });

  }

};

function gitDocToSearchDoc(gitDoc) {
  let searchDoc = {};
  if (gitDoc.attributes) {
    for (let attribute of Object.keys(gitDoc.attributes)) {
      let value = gitDoc.attributes[attribute];
      searchDoc[attribute] = value;
    }
  }
  if (gitDoc.relationships) {
    for (let attribute of Object.keys(gitDoc.relationships)) {
      let value = gitDoc.relationships[attribute];
      searchDoc[attribute] = value;
    }
  }
  return searchDoc;
}

const opsPrivate = new WeakMap();

class PublicOperations {
  constructor(es, branch, realTime) {
    opsPrivate.set(this, {
      branch,
      bulkOps: new BulkOps(es, { realTime })
    });
  }
  async save(type, id, doc){
    let { bulkOps, branch } = opsPrivate.get(this);
    let searchDoc = gitDocToSearchDoc(doc);
    await bulkOps.add({
      index: {
        _index: branch,
        _type: type,
        _id: id,
      }
    }, searchDoc);
  }
  async delete(type, id) {
    let { bulkOps, branch } = opsPrivate.get(this);
    await bulkOps.add({
      delete: {
        _index: branch,
        _type: type,
        _id: id
      }
    });
  }
}

class SchemaOperations {
  constructor(es, branch, realTime) {
    opsPrivate.set(this, {
      es,
      branch,
      realTime,
      changes: new Map(),
      applyTo(models) {
        let unchanged = models.filter(
          model => !this.changes.has(`${model.type}/${model.id}`)
        );
        let changed = [];
        for (let [key, gitDoc] of this.changes.entries()) {
          if (gitDoc) {
            let [type, id] = key.split('/');
            changed.push({
              type,
              id,
              document: gitDocToSearchDoc(gitDoc)
            });
          }
        }
        return unchanged.concat(changed);
      },
      async writeOut() {
        let publicOps = new PublicOperations(this.es, this.branch, this.realTime);
        let privateOps = opsPrivate.get(publicOps);
        for (let [key, document] of this.changes.entries()) {
          let [type, id] = key.split('/');
          if (document) {
            await publicOps.save(type, id, document);
          } else {
            await publicOps.delete(type, id);
          }
        }
        await privateOps.bulkOps.flush();
      }
    });
  }
  async save(type, id, document) {
    let { changes } = opsPrivate.get(this);
    changes.set(`${type}/${id}`, document);
  }
  async delete(type, id) {
    let { changes } = opsPrivate.get(this);
    changes.set(`${type}/${id}`, null);
  }
}
