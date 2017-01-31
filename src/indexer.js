const {
  Repository,
  Reference,
  Branch,
  Commit
} = require('nodegit');

const { safeEntryByName } = require('./mutable-tree');

const logger = require('heimdalljs-logger');
const makeClient = require('./elastic-client');
const { isEqual } = require('lodash');

module.exports = class Indexer {
  constructor({ elasticsearch, repoPath }) {
    this.es = makeClient(elasticsearch);
    this.repoPath = repoPath;
    this.repo = null;
    this.log = logger('indexer');
  }

  async update() {
    await this._ensureRepo();
    let branches = await this._branches();
    await Promise.all(branches.map(branch => this._updateBranch(branch)));
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

  async _updateBranch(branch) {
    let commit = await this._commitAtBranch(branch);
    let tree = await commit.getTree();
    let haveMapping = await this._esMapping(branch);
    let wantMapping = await this._gitMapping(tree);
    if (this._stableMapping(haveMapping, wantMapping)) {
      this.log.info(`${branch}: mapping already OK`);
    } else {
      this.log.info(`${branch}: mapping needs update`);
      this.log.debug(JSON.stringify({ haveMapping, wantMapping }, null, 2));
      let tmpIndex = this._tempIndexName(branch);
      await this.es.indices.create({
        index: tmpIndex,
        body: {
          mappings: wantMapping
        }
      });
      await this._reindex(tmpIndex, branch);
    }
    await this._updateState(branch, tree, commit);
  }

  async _updateState(branch, tree, commit) {
    let originalTree;
    let meta = await this.es.getSource({ index: branch, type: 'meta', id: 'indexer', ignore: [404] });
    if (meta) {
      let oldCommit = await Commit.lookup(this.repo, meta.commit);
      originalTree = await oldCommit.getTree();
    }

    await this._indexTree(branch, originalTree, tree);

    await this.es.index({
      index: branch,
      type: 'meta',
      id: 'indexer',
      body: {
        commit: commit.id().tostrS()
      }
    });
  }

  async _indexTree(branch, oldTree, newTree) {
    let seen = new Map();
    if (newTree) {
      for (let newEntry of newTree.entries()) {
        let name = newEntry.name();
        let oldEntry;
        seen.set(name, true);
        if (oldTree) {
          oldEntry = safeEntryByName(oldTree, name);
          if (oldEntry && oldEntry.id().equal(newEntry.id())) {
            // We can prune whole subtrees when we find an identical
            // entry. Which is kinda the point of Git's data
            // structure in the first place.
            continue;
          }
        }
        if (newEntry.isTree()) {
          await this._indexTree(
            branch,
            oldEntry && oldEntry.isTree() ? (await oldEntry.getTree()) : null,
            await newEntry.getTree()
          );
        } else {
          let { type, id } = identify(newEntry);
          await this.es.index({
            index: branch,
            type,
            id,
            body: (await newEntry.getBlob()).content().toString('utf8')
          });
        }
      }
    }
    if (oldTree) {
      for (let oldEntry of oldTree.entries()) {
        let name = oldEntry.name();
        if (!seen.get(name)) {
          if (oldEntry.isTree()) {
            await this._indexTree(branch, await oldEntry.getTree(), null);
          } else {
            let { type, id } = identify(oldEntry);
            await this.es.delete({
              index: branch,
              type,
              id
            });
          }
        }
      }
    }
  }

  // 1. Index the branch into newIndex.
  // 2. Update the canonical elasticsearch alias for the branch to point at newIndex
  // 3. Delete any old index that we just replaced.
  async _reindex(newIndex, branch) {
    let alias = await this.es.indices.getAlias({ name: branch, ignore: [404] });
    if (alias.status === 404) {
      this.log.info(`${branch} is new, nothing to reindex`);
    } else {
      this.log.info(`reindexing ${branch}`);
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
