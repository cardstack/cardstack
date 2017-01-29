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

  _defaultMapping() {
    return {
      meta: {
        properties: {
          commit: {
            type: "object",
            enabled: false
          }
        }
      }
    };
  }

  _tempIndexName(branch) {
    return `${branch}_${Date.now()}`;
  }

  async _updateBranch(branch) {
    let commit = await this._commitAtBranch(branch);
    let tree = await commit.getTree();
    let haveMapping = await this._esMapping(branch);
    let wantMapping = Object.assign(this._defaultMapping(), await this._gitMapping(tree));
    if (isEqual(haveMapping, wantMapping)) {
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
    await this._updateState(branch, commit);
  }

  async _updateState(branch, commit) {


    await this.es.index({
      index: branch,
      type: 'meta',
      id: 'indexer',
      body: {
        commit: commit.id().tostrS()
      }
    });
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
      await this.es.indices.reindex({
        source: { index: branch },
        dest: { index: newIndex }
      });

    }
    await this.es.indices.putAlias({
      name: branch,
      index: newIndex
    });

  }

  async _branches() {
    // nodegit docs show a Branch.iteratorNew method that would be
    // more appropriate than this, but as far as I can tell it is not
    // fully implemented
    return (await Reference.list(this.repo)).map(entry => entry.replace(/^refs\/heads\//, ''));
  }

};
