const {
  Repository,
  Reference,
  Branch,
  Commit
} = require('nodegit');

const { safeEntryByName } = require('./mutable-tree');

const logger = require('heimdalljs-logger');

module.exports = class Indexer {
  constructor({ repo, basePath, branchPrefix }) {
    this.repoPath = repo;
    this.branchPrefix = branchPrefix || "";
    this.basePath = basePath ? basePath.split('/') : [];
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

    let pattern = new RegExp(`^refs\/heads\/${this.branchPrefix}(.*)`);
    return (await Reference.list(this.repo)).map(entry => {
      let m = pattern.exec(entry);
      if (m) {
        return m[1];
      }
    }).filter(Boolean);
  }

  async beginUpdate(branch) {
    await this._ensureRepo();
    return new GitUpdater(this.repo, this.branchPrefix + branch, this.log, this.repoPath, this.basePath);
  }
};

class GitUpdater {
  constructor(repo, branch, log, repoPath, basePath) {
    this.repo = repo;
    this.basePath = basePath;
    this.branch = branch;
    this.commit = null;
    this.commitId = null;
    this.rootTree = null;
    this.name = `git/${repoPath}`;
    this.log = log;
  }

  async schema() {
    let models = [];
    let ops = new Gather(models);
    await this._loadCommit();
    await this._indexTree(ops, null, this.rootTree, {
      only: this.basePath.concat(['schema'])
    });
    return models;
  }

  async updateContent(meta, hints, ops) {
    await this._loadCommit();
    let originalTree;
    if (meta && meta.commit) {
      try {
        let oldCommit = await Commit.lookup(this.repo, meta.commit);
        originalTree = await oldCommit.getTree();
      } catch (err) {
        this.log.warn(`Unable to load previously indexed commit ${meta.commit} due to ${err}. We will recover by reindexing all content.`);
      }
    }
    await this._indexTree(ops, originalTree, this.rootTree, {
      only: this.basePath.concat([['schema', 'contents']])
    });
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

  async _indexTree(ops, oldTree, newTree, filter) {
    let seen = new Map();
    if (newTree) {
      for (let newEntry of newTree.entries()) {
        let name = newEntry.name();
        if (!filterAllows(filter, name)) {
          continue;
        }
        seen.set(name, true);
        await this._indexEntry(ops, name, oldTree, newEntry, filter);
      }
    }
    if (oldTree) {
      for (let oldEntry of oldTree.entries()) {
        let name = oldEntry.name();
        if (!filterAllows(filter, name)) {
          continue;
        }
        if (!seen.get(name)) {
          await this._deleteEntry(ops, oldEntry, filter);
        }
      }
    }
  }

  async _indexEntry(ops, name, oldTree, newEntry, filter) {
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
        await newEntry.getTree(),
        nextFilter(filter)
      );
    } else if (/\.json$/i.test(newEntry.path())) {
      let { type, id } = identify(newEntry);
      let contents = (await newEntry.getBlob()).content().toString('utf8');
      let doc;
      try {
        doc = JSON.parse(contents);
      } catch (err) {
        this.log.warn("Ignoring record with invalid json at %s", newEntry.path());
        return;
      }
      if (!doc.meta) {
        doc.meta = {};
      }
      doc.meta.version = this.commitId;
      await ops.save(type, id, doc);
    }
  }

  async _deleteEntry(ops, oldEntry, filter) {
    if (oldEntry.isTree()) {
      await this._indexTree(ops, await oldEntry.getTree(), nextFilter(filter));
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

function filterAllows(filter, name) {
  return !filter || !filter.only || filter.only.length === 0 ||
    (Array.isArray(filter.only[0]) && filter.only[0].includes(name)) ||
    name === filter.only[0];
}

function nextFilter(filter) {
  if (!filter || !filter.only || filter.only.length < 2) {
    return null;
  }
  return { only: filter.only.slice(1) };
}
