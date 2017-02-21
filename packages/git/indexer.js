/*
  Indexer deals with indexing documents. It's public API is just
  `update`, which is responsible for getting any new upstream content
  into the search index.

  update takes these optional arguments:

    - realTime: when true, update will block until the resulting
      changes are visible in elasticsearch. This is somewhat
      expensive, which is why we make it optional. Most of the time
      non-realtime is good enough and much faster. Defaults to false.

    - hints: can contain a list of `{ id, type }` references. This is
      intended as an optimization hint when we know that certain
      resources are the ones that likely need to be indexed right
      away. Indexers are responsible for discovering and indexing
      arbitrary upstream changes regardless of this hint, but the hint
      can make it easier to keep the search index nearly real-time
      fresh.

*/

const {
  Repository,
  Reference,
  Branch,
  Commit
} = require('nodegit');

const { safeEntryByName } = require('./mutable-tree');

const logger = require('heimdalljs-logger');
const makeClient = require('@cardstack/data-source/elastic-client');
const { isEqual } = require('lodash');
const BulkOps = require('./bulk-ops');

module.exports = class Indexer {
  constructor({ elasticsearch, repoPath }) {
    this.es = makeClient(elasticsearch);
    this.repoPath = repoPath;
    this.repo = null;
    this.log = logger('indexer');
  }

  /*
    This indexes the content of the repo, based on the following general rules:
    - each `.json` file in git is a document to be indexed.
    - the id is the name of the file without the extension
    - the type is the name of the directory in which the file appears
      (just the final part of the path)
    - a special mappings.json file at the top of the repo can make
      declarations about the schema.

    `realTime` determines whether this operation will block until
    searches will reflect our changes. It's more expensive, but very
    helpful particularly in automated test scenarios.

  */
  async update({ realTime /* , hints */ } = {}) {
    await this._ensureRepo();
    let branches = await this._branches();
    await Promise.all(branches.map(branch => this._updateBranch(branch, realTime)));
  }

  async _ensureRepo() {
    if (!this.repo) {
      this.repo = await Repository.open(this.repoPath);
    }
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

  async _commitAtBranch(branchName) {
    let branch = await Branch.lookup(this.repo, branchName, Branch.BRANCH.LOCAL);
    return Commit.lookup(this.repo, branch.target());
  }

  async _gitMapping(tree) {
    let entry = await safeEntryByName(tree, 'mapping.json');
    if (entry && entry.isBlob()) {
      let buffer = (await entry.getBlob()).content();
      let mapping = JSON.parse(buffer);
      return mapping;
    } else {
      return {};
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

  async _updateBranch(branch, realTime) {
    let commit = await this._commitAtBranch(branch);
    let tree = await commit.getTree();
    let haveMapping = await this._esMapping(branch);
    let wantMapping = await this._gitMapping(tree);
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
    await this._updateState(branch, tree, commit, realTime);
  }

  async _updateState(branch, tree, commit, realTime) {
    let originalTree;
    let meta = await this.es.getSource({ index: branch, type: 'meta', id: 'indexer', ignore: [404] });
    if (meta) {
      let oldCommit = await Commit.lookup(this.repo, meta.commit);
      originalTree = await oldCommit.getTree();
    }

    let bulkOps = new BulkOps(this.es, { realTime });

    await this._indexTree(branch, originalTree, tree, bulkOps);

    await bulkOps.add({
      index: {
        _index: branch,
        _type: 'meta',
        _id: 'indexer',
      }
    }, {
      commit: commit.id().tostrS()
    });

    await bulkOps.flush();
  }

  async _indexTree(branch, oldTree, newTree, bulkOps) {
    let seen = new Map();
    if (newTree) {
      for (let newEntry of newTree.entries()) {
        let name = newEntry.name();
        seen.set(name, true);
        await this._indexEntry(branch, name, oldTree, newEntry, bulkOps);
      }
    }
    if (oldTree) {
      for (let oldEntry of oldTree.entries()) {
        let name = oldEntry.name();
        if (!seen.get(name)) {
          await this._deleteEntry(branch, oldEntry, bulkOps);
        }
      }
    }
  }

  async _indexEntry(branch, name, oldTree, newEntry, bulkOps) {
    let oldEntry;
    if (oldTree) {
      oldEntry = safeEntryByName(oldTree, name);
      if (oldEntry && oldEntry.id().equal(newEntry.id())) {
        // We can prune whole subtrees when we find an identical
        // entry. Which is kinda the point of Git's data
        // structure in the first place.
        return;
      }
    }
    if (newEntry.isTree()) {
      await this._indexTree(
        branch,
        oldEntry && oldEntry.isTree() ? (await oldEntry.getTree()) : null,
        await newEntry.getTree(),
        bulkOps
      );
    } else {
      let { type, id } = identify(newEntry);
      await bulkOps.add({
        index: {
          _index: branch,
          _type: type,
          _id: id,
        }
      }, (await newEntry.getBlob()).content().toString('utf8'));
    }
  }

  async _deleteEntry(branch, oldEntry, bulkOps) {
    if (oldEntry.isTree()) {
      await this._indexTree(branch, await oldEntry.getTree(), null, bulkOps);
    } else {
      let { type, id } = identify(oldEntry);
      await bulkOps.add({
        delete: {
          _index: branch,
          _type: type,
          _id: id
        }
      });
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

  async _branches() {
    // nodegit docs show a Branch.iteratorNew method that would be
    // more appropriate than this, but as far as I can tell it is not
    // fully implemented
    return (await Reference.list(this.repo)).map(entry => entry.replace(/^refs\/heads\//, ''));
  }

};

function identify(entry) {
  let parts = entry.path().split('/');
  let type = parts[parts.length - 2] || 'tops';
  let filename = parts[parts.length - 1];
  let id = filename.replace(/\.json$/, '');
  return { type, id };
}
