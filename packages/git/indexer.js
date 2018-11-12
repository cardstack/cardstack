/*

  Since this is the first Indexer, this seems like a reasonable place
  to document the Indexer protocol:

  - an indexer gets instantiated by the Hub for each configured data
    source.

  - the Indexer's constructor arguments come from the data-source's
    `params` attribute. That is, a data source like a Git repository
    is configured by creating a record of type "data-sources", with a
    source-type attribute that points at a module like this one
    ("@cardstack/git") and a params attribute that contains the
    source-type-specific configuration (in this case, `repo`,
    `basePath`, and `branchPrefix`).

  - the indexer must implement `branches`, which returns a list of
    branch names. In the case of Git, branch literally means
    branch. But other indexers can also make use of the concept of
    branches to support multiple environments (like produciton vs
    staging databases). It's up to the indexer to discover branches
    because they may be as dynamic as desired.

  - branch names may span across data sources. For example, both Git
    and Postgres may have "proudction" branches, and both may define
    both schema and content.

  - an indexer must implement beginUpdate(branch), which returns an
    updater. The updater represents a running update action, and it's
    appropriate that it can be more stateful than an indexer.

  - an updater must implement schema(), which returns the list of
    schema records the data source would like to define. It's not
    mandatory for every data source to define schema -- it's OK to
    only contain content and rely on schema that's stored in a
    different data source. schema() is a separate method because we
    need to know the schema up front, before we can index the rest of
    the content.

  - an updater must implement updateContent(meta, hints, ops), which
    generates the actual update operations to add and remove records
    from the search index.

      - `meta` can store whatever you want, it's your place to keep
        track of how far your indexer has progressed. The value that
        you return from updateContent() will be passed into the next
        call to updateContent() as `meta`.

      - `hints` can contain a list of `{ branch, id, type }`
        references. This is intended as an optimization hint when we
        know that certain resources are the ones that likely need to
        be indexed right away. Indexers are responsible for
        discovering and indexing arbitrary upstream changes regardless
        of this hint, but the hint can make it easier to keep the
        search index nearly real-time fresh.

      - `ops` has two methods you can call: `save(type, id, doc)` and
        `delete(type, id)`. Both are async and you should await them
        (you don't need to do batching, the Hub manages that for you,
        but the methods are async because you can't necessarily
        predict when it will decide to flush).

    `updateContent` should call `ops.save` and/or `ops.delete` as many
    times as necessary, then return a new `meta` state.

    `read` should return an up-to-date json-api document directly from
    the data source. It will sometimes be used to update caches.

  - the Hub ensures that only one indexer per data source is
    instantiated and running at a given time. You don't need to
    implement locking in the indexer.

  - multiple updaters may run in parallel (one for each branch
    name). The Hub guarantees it will call `beginUpdate` for every
    branch before it calls `updateContent` on any of them -- this
    allows you to implement your own coordination if there are
    inter-branch ordering concerns.

*/

const {
  Repository,
  Reference,
  Branch,
  Commit,
} = require('nodegit');

const Change = require("./change");

const { safeEntryByName } = require('./mutable-tree');

const log = require('@cardstack/logger')('cardstack/git');

const service = require('./service');

module.exports = class Indexer {
  static create(params) { return new this(params); }

  constructor({ repo, basePath, branchPrefix, remote }) {
    if (repo && remote) {
      throw new Error('You cannot define the params \'remote\' and \'repo\' at the same time for this data source');
    }
    this.repoPath = repo;
    this.branchPrefix = branchPrefix || "";
    this.basePath = basePath ? basePath.split('/') : [];
    this.repo = null;
    this.remote = remote;
  }


  async _ensureRepo() {
    if (!this.repo) {
      if (this.remote) {
        this.repo = await service.getRepo(this.remote.url, this.remote);
        return;
      }

      try {
        this.repo = await Repository.open(this.repoPath);
      } catch (e) {
        if (/(could not find repository from|Failed to resolve path)/i.test(e.message)) {

          let change = await Change.createInitial(this.repoPath, 'master');
          this.repo = change.repo;

          await change.finalize({
            message: 'First commit',
            authorName: 'Cardstack Hub',
            authorEmail: 'hub@cardstack.com',
          });
        } else {
          throw e;
        }
      }
    }
  }

  async branches() {
    await this._ensureRepo();
    // nodegit docs show a Branch.iteratorNew method that would be
    // more appropriate than this, but as far as I can tell it is not
    // fully implemented

    let pattern = new RegExp(`^refs/heads/${this.branchPrefix}(.*)`);
    return (await Reference.list(this.repo)).map(entry => {
      let m = pattern.exec(entry);
      if (m) {
        return m[1];
      }
    }).filter(Boolean);
  }

  async beginUpdate(branch) {
    await this._ensureRepo();

    let targetBranch = this.branchPrefix + branch;

    if (this.remote) {
      await service.pullRepo(this.remote.url, targetBranch);
    }

    return new GitUpdater(this.repo, targetBranch, this.repoPath, this.basePath);
  }
};

class GitUpdater {
  constructor(repo, branch, repoPath, basePath) {
    this.repo = repo;
    this.basePath = basePath;
    this.branch = branch;
    this.commit = null;
    this.commitId = null;
    this.rootTree = null;
  }

  async schema() {
    let models = [];
    let ops = new Gather(models);
    await this._loadCommit();
    await this._indexTree(ops, null, this.rootTree, {
      only: this.basePath.concat(['schema'])
    });
    return models.map(m => m.data);
  }

  async updateContent(meta, hints, ops) {
    await this._loadCommit();
    let originalTree;
    if (meta && meta.commit) {
      try {
        let oldCommit = await Commit.lookup(this.repo, meta.commit);
        originalTree = await oldCommit.getTree();
      } catch (err) {
        log.warn(`Unable to load previously indexed commit ${meta.commit} due to ${err}. We will recover by reindexing all content.`);
      }
    }
    if (!originalTree) {
      await ops.beginReplaceAll();
    }
    await this._indexTree(ops, originalTree, this.rootTree, {
      only: this.basePath.concat([['schema', 'contents']])
    });
    if (!originalTree) {
      await ops.finishReplaceAll();
    }
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
      let doc = await this._entryToDoc(type, id, newEntry);
      if (doc) {
        await ops.save(type, id, { data: doc });
      }
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

  async _entryToDoc(type, id, entry) {
    entry.isBlob();
    let contents = (await entry.getBlob()).content().toString('utf8');
    let doc;
    try {
      doc = JSON.parse(contents);
    } catch (err) {
      log.warn("Ignoring record with invalid json at %s", entry.path());
      return;
    }
    doc.type = type;
    doc.id = id;
    if (!doc.meta) {
      doc.meta = {};
    }

    // A note on the cardstack meta versioning protocol:
    //
    // meta.version is a point-in-time version indicator. If you
    // change and then undo, you should end up at a different
    // version than where you started. In the git data-source,
    // meta.version is the ID of a commit.
    //
    // meta.hash is a content hash. If you change and then undo, you
    // should end up back at the original meta.hash. In this git
    // data-source, this is ID of a blob.
    doc.meta.version = this.commitId;
    doc.meta.hash = entry.id().tostrS();
    return doc;
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
