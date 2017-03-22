const {
  Repository,
  Reference,
  Branch,
  Commit
} = require('nodegit');

const { safeEntryByName } = require('./mutable-tree');

const logger = require('heimdalljs-logger');

module.exports = class Indexer {
  constructor({ repo }) {
    this.repoPath = repo;
    this.repo = null;
    this.log = logger('git-indexer');
  }

  async _ensureRepo() {
    if (!this.repo) {
      this.repo = await Repository.open(this.repoPath);
    }
  }

  async branches() {
    await this._ensureRepo();
    // nodegit docs show a Branch.iteratorNew method that would be
    // more appropriate than this, but as far as I can tell it is not
    // fully implemented
    return (await Reference.list(this.repo)).map(entry => entry.replace(/^refs\/heads\//, ''));
  }

  async beginUpdate(branch) {
    await this._ensureRepo();
    return new GitUpdater(this.repo, branch);
  }
};

class GitUpdater {
  constructor(repo, branch) {
    this.repo = repo;
    this.branch = branch;
    this.commit = null;
    this.commitId = null;
    this.rootTree = null;
    this.name = 'git';
  }

  async schema() {
    let models = [];
    let ops = new Gather(models);
    await this._loadCommit();
    await this._indexTree(ops, null, this.rootTree, { only: 'schema' });
    return models;
  }

  async updateContent(meta, hints, ops) {
    await this._loadCommit();
    let originalTree;
    if (meta && meta.commit) {
      let oldCommit = await Commit.lookup(this.repo, meta.commit);
      originalTree = await oldCommit.getTree();
    }
    await this._indexTree(ops, originalTree, this.rootTree);
    return {
      commit: this.commitId
    };
  }

  async _loadCommit() {
    if (!this.commit) {
      this.commit = await this._commitAtBranch(this.branch);
      this.commitId = this.commit.id().tostrS();
    }
    if (!this.rootTree) {
      this.rootTree = await this.commit.getTree();
    }
  }

  async _commitAtBranch(branchName) {
    let branch = await Branch.lookup(this.repo, branchName, Branch.BRANCH.LOCAL);
    return Commit.lookup(this.repo, branch.target());
  }

  async _indexTree(ops, oldTree, newTree, filter={}) {
    let seen = new Map();
    if (newTree) {
      for (let newEntry of newTree.entries()) {
        let name = newEntry.name();
        if (filter.only && name !== filter.only) {
          continue;
        }
        seen.set(name, true);
        await this._indexEntry(ops, name, oldTree, newEntry);
      }
    }
    if (oldTree) {
      for (let oldEntry of oldTree.entries()) {
        let name = oldEntry.name();
        if (filter.only && name !== filter.only) {
          continue;
        }
        if (!seen.get(name)) {
          await this._deleteEntry(ops, oldEntry);
        }
      }
    }
  }

  async _indexEntry(ops, name, oldTree, newEntry) {
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
        ops,
        oldEntry && oldEntry.isTree() ? (await oldEntry.getTree()) : null,
        await newEntry.getTree()
      );
    } else {
      let { type, id } = identify(newEntry);
      let doc = JSON.parse((await newEntry.getBlob()).content().toString('utf8'));
      if (!doc.meta) {
        doc.meta = {};
      }
      doc.meta.version = this.commitId;
      await ops.save(type, id, doc);
    }
  }

  async _deleteEntry(ops, oldEntry) {
    if (oldEntry.isTree()) {
      await this._indexTree(ops, await oldEntry.getTree(), null);
    } else {
      let { type, id } = identify(oldEntry);
      await ops.delete(type, id);
    }
  }
}


function identify(entry) {
  let parts = entry.path().split('/');
  let type = parts[parts.length - 2] || 'tops';
  let filename = parts[parts.length - 1];
  let id = filename.replace(/\.json$/, '');
  return { type, id };
}

class Gather {
  constructor(models) {
    this.models = models;
  }
  save(type, id, document) {
    document.type = type;
    document.id = id;
    this.models.push(document);
  }
}
