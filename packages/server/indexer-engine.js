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
const makeClient = require('@cardstack/data-source/elastic-client');
const { isEqual } = require('lodash');
const BulkOps = require('./bulk-ops');

module.exports = class Indexer {
  constructor(indexers) {
    this.indexers = indexers;
    this.es = makeClient();
    this.log = logger('indexer-engine');
  }

  async update({ realTime, hints} = {}) {
    let branches = await this._branches(hints);
    await Promise.all(Object.keys(branches).map(
      branchName => this._updateBranch(branchName, branches[branchName], realTime, hints)
    ));
  }

  async _updateBranch(branch, updaters, realTime, hints) {
    let wantMapping = await this._desiredMapping(updaters);
    let haveMapping = await this._esMapping(branch);

    if (this._stableMapping(haveMapping, wantMapping)) {
      this.log.info('%s: mapping already OK', branch);
    } else {
      this.log.info('%s: mapping needs update', branch);
      this.log.debug('%j', { haveMapping, wantMapping });
      let tmpIndex = this._tempIndexName(branch);
      await this.es.indices.create({
        index: tmpIndex,
        body: {
          mappings: wantMapping
        }
      });
      await this._reindex(tmpIndex, branch);
    }
    await this._updateState(branch, updaters, realTime, hints);
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

  async _desiredMapping(updaters) {
    let combinedMapping = {};
    await Promise.all(updaters.map(async updater => {
      Object.assign(combinedMapping, await updater.mappings());
    }));
    return combinedMapping;
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

  async _updateState(branch, updaters, realTime, hints) {
    for (let updater of updaters) {
      let bulkOps = new BulkOps(this.es, { realTime });
      let meta = await this.es.getSource({
        index: branch,
        type: 'meta',
        id: updater.name,
        ignore: [404]
      });
      let newMeta = await updater.run(meta, hints, async (type, id, doc) => {
        if (doc) {
          await bulkOps.add({
            index: {
              _index: branch,
              _type: type,
              _id: id,
            }
          }, doc);
        } else {
          await bulkOps.add({
            delete: {
              _index: branch,
              _type: type,
              _id: id
            }
          });
        }
      });
      await bulkOps.add({
        index: {
          _index: branch,
          _type: 'meta',
          _id: updater.name,
        }
      }, newMeta);
      await bulkOps.flush();
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
