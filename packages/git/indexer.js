const {
  Repository,
  Reference,
  Branch,
  Commit
} = require('nodegit');

const { safeEntryByName } = require('./mutable-tree');

const logger = require('heimdalljs-logger');

module.exports = class Indexer {
  constructor({ repoPath }) {
    this.repoPath = repoPath;
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
    this.rootTree = null;
    this.name = 'git';
    this.save = null;
  }

  async mappings() {
    await this._loadCommit();
    return this._gitMapping(this.rootTree);
  }

  async _loadCommit() {
    if (!this.commit) {
      this.commit = await this._commitAtBranch(this.branch);
    }
    if (!this.rootTree) {
      this.rootTree = await this.commit.getTree();
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

  async run(meta, hints, save) {
    await this._loadCommit();
    this.save = save;
    let originalTree;
    if (meta) {
      let oldCommit = await Commit.lookup(this.repo, meta.commit);
      originalTree = await oldCommit.getTree();
    }
    await this._indexTree(originalTree, this.rootTree);
    return {
      commit: this.commit.id().tostrS()
    };
  }

  async _indexTree(oldTree, newTree) {
    let seen = new Map();
    if (newTree) {
      for (let newEntry of newTree.entries()) {
        let name = newEntry.name();
        seen.set(name, true);
        await this._indexEntry(name, oldTree, newEntry);
      }
    }
    if (oldTree) {
      for (let oldEntry of oldTree.entries()) {
        let name = oldEntry.name();
        if (!seen.get(name)) {
          await this._deleteEntry(oldEntry);
        }
      }
    }
  }

  async _indexEntry(name, oldTree, newEntry) {
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
        oldEntry && oldEntry.isTree() ? (await oldEntry.getTree()) : null,
        await newEntry.getTree()
      );
    } else {
      let { type, id } = identify(newEntry);
      let doc = (await newEntry.getBlob()).content().toString('utf8');
      await this.save(type, id, doc);
    }
  }

  async _deleteEntry(oldEntry) {
    if (oldEntry.isTree()) {
      await this._indexTree(await oldEntry.getTree(), null);
    } else {
      let { type, id } = identify(oldEntry);
      await this.save(type, id, null);
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
}


function identify(entry) {
  let parts = entry.path().split('/');
  let type = parts[parts.length - 2] || 'tops';
  let filename = parts[parts.length - 1];
  let id = filename.replace(/\.json$/, '');
  return { type, id };
}
