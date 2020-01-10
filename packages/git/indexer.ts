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

  - branch names may span across data sources. For example, both Git
    and Postgres may have "proudction" branches, and both may define
    both schema and content.

  - an indexer must implement beginUpdate(), which returns an
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

      - `hints` can contain a list of `{ id, type }`
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

*/

import { Repository, Commit, RemoteConfig, Tree, TreeEntry } from './git';

import Change from './change';
import logger from '@cardstack/logger';
const log = logger('cardstack/git');
import service from './service';
import { set, intersection } from 'lodash';

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const { isInternalCard, adoptionChain } = require('@cardstack/plugin-utils/card-utils');
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const { declareInjections } = require('@cardstack/di');
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const Session = require('@cardstack/plugin-utils/session');

import { todo } from '@cardstack/plugin-utils/todo-any';

const defaultBranch = 'master';

interface IndexerSettings {
  dataSource: todo;
  repo: string;
  basePath: string;
  branchPrefix: string;
  remote: RemoteConfig;
  searchers: todo;
}

module.exports = declareInjections(
  {
    searchers: 'hub:searchers',
  },

  class Indexer {
    static create(params: IndexerSettings) {
      return new this(params);
    }

    dataSource: todo;
    repoPath?: string;
    cardTypes: string[];
    basePath: todo[];
    branchPrefix?: string;
    remote?: RemoteConfig;
    searchers: todo;
    repo?: Repository;
    __owner__: todo;

    constructor({ dataSource, repo, basePath, branchPrefix, remote, searchers }: IndexerSettings) {
      if (repo && remote) {
        throw new Error("You cannot define the params 'remote' and 'repo' at the same time for this data source");
      }
      this.repoPath = repo;
      this.searchers = searchers;
      this.cardTypes = dataSource.cardTypes || [];
      this.branchPrefix = branchPrefix || '';
      this.basePath = basePath ? basePath.split('/') : [];
      this.remote = remote;
    }

    async _ensureRepo() {
      if (!this.repo) {
        if (this.remote) {
          log.info('Getting remote repo for %s from service', this.remote.url);
          this.repo = await service.getRepo(this.remote.url, this.remote);
          return;
        }

        try {
          this.repo = await Repository.open(this.repoPath!);
        } catch (e) {
          if (/(could not find repository from|Failed to resolve path)/i.test(e.message)) {
            let change = await Change.createInitial(this.repoPath!, 'master');
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

    async beginUpdate() {
      log.debug(`starting beginUpdate()`);
      await this._ensureRepo();

      let targetBranch = this.branchPrefix + defaultBranch;

      if (this.remote) {
        await service.pullRepo(this.remote.url, targetBranch);
      }
      log.debug(`ending beginUpdate()`);

      return new GitUpdater(this.repo!, targetBranch, this.basePath, this.searchers, this.cardTypes, this.__owner__);
    }
  }
);

class GitUpdater {
  commit?: Commit;
  commitId?: string;
  rootTree: todo;

  constructor(
    readonly repo: Repository,
    readonly branch: string,
    readonly basePath: todo[],
    readonly searchers: todo,
    readonly cardTypes: string[],
    readonly owner: todo
  ) {}

  async schema() {
    let models: todo[] = [];

    let ops = new Gather(models);
    await this._loadCommit();
    await this._indexTree(ops, undefined, this.rootTree, {
      only: this.basePath.concat(['schema']),
    });
    return models.map(m => m.data);
  }

  async _ensureBaseCard() {
    if (this.cardTypes && this.cardTypes.length) {
      // lazily performing the lookup of card services so that the base card creation doesn't
      // interfere with the remote syncing as base card may actually be written to git,
      // which may require a merge, as well as a promise to reconcile, which we do below.
      let cardServices = this.owner.lookup('hub:card-services');
      await cardServices._setupPromise;
    }
  }

  async getInternalCard(cardId: string) {
    let card;
    try {
      card = await this.searchers.get(Session.INTERNAL_PRIVILEGED, 'local-hub', cardId, cardId);
    } catch (err) {
      if (err.status !== 404) {
        throw err;
      }
    }
    return card;
  }

  async updateContent(meta: todo, hints: todo[], ops: todo) {
    log.debug(`starting updateContent()`);
    await this._loadCommit();
    let originalTree;
    if (meta && meta.commit) {
      try {
        let oldCommit = await Commit.lookup(this.repo, meta.commit);
        originalTree = await oldCommit.getTree();
      } catch (err) {
        log.warn(
          `Unable to load previously indexed commit ${meta.commit} due to ${err}. We will recover by reindexing all content.`
        );
      }
    }
    if (!originalTree) {
      await ops.beginReplaceAll();
    }
    await this._indexTree(ops, originalTree, this.rootTree, {
      only: this.basePath.concat([['schema', 'contents', 'cards']]),
    });
    if (!originalTree) {
      await ops.finishReplaceAll();
    }
    log.debug(`completed updateContent()`);
    return {
      commit: this.commitId,
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

  async _commitAtBranch(branchName: string) {
    let branch = await this.repo.lookupLocalBranch(branchName);
    return Commit.lookup(this.repo, branch.target());
  }

  async _indexTree(ops: todo, oldTree: Tree | undefined, newTree: Tree | undefined, filter?: todo) {
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

  async _indexEntry(ops: todo, name: string, oldTree: Tree | undefined, newEntry: TreeEntry, filter: todo) {
    let oldEntry;
    if (oldTree) {
      oldEntry = oldTree.entryByName(name);
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
        oldEntry && oldEntry.isTree() ? await oldEntry.getTree() : undefined,
        await newEntry.getTree(),
        nextFilter(filter)
      );
    } else if (/\.json$/i.test(newEntry.path())) {
      let { type, id } = identify(newEntry);
      let doc = await this._entryToDoc(type, id, newEntry);
      if (doc) {
        if (isInternalCard(type, id)) {
          await this._ensureBaseCard();

          let chain = (await adoptionChain(doc, this.getInternalCard.bind(this))).map((i: todo) => i.data.id);
          if (!intersection(this.cardTypes, chain).length) {
            return;
          }

          await ops.save(type, id, doc);
        } else {
          await ops.save(type, id, { data: doc });
        }
      }
    }
  }

  async _deleteEntry(ops: todo, oldEntry: TreeEntry, filter: todo) {
    if (oldEntry.isTree()) {
      await this._indexTree(ops, await oldEntry.getTree(), undefined, nextFilter(filter));
    } else {
      let { type, id } = identify(oldEntry);
      await ops.delete(type, id);
    }
  }

  async _entryToDoc(type: string, id: string, entry: TreeEntry) {
    entry.isBlob();
    let contents = (await entry.getBlob()).content().toString('utf8');
    let doc;
    try {
      doc = JSON.parse(contents);
    } catch (err) {
      log.warn('Ignoring record with invalid json at %s', entry.path());
      return;
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
    if (!isInternalCard(type, id)) {
      doc.type = type;
      doc.id = id;
      set(doc, 'meta.version', this.commitId);
      set(doc, 'meta.hash', entry.id().tostrS());
    } else {
      set(doc, 'data.meta.version', this.commitId);
      set(doc, 'data.meta.hash', entry.id().tostrS());
    }

    return doc;
  }
}

function identify(entry: TreeEntry) {
  let type, id;
  let parts = entry.path().split('/');
  if (parts[0] === 'cards' && parts.length > 1) {
    parts.shift();
    id = type = parts.join('/').replace(/\.json$/, '');
  } else {
    type = parts[parts.length - 2] || 'tops';
    let filename = parts[parts.length - 1];
    id = filename.replace(/\.json$/, '');
  }
  return { type, id };
}

class Gather {
  constructor(readonly models: todo[]) {}
  save(type: string, id: string, document: todo) {
    if (!isInternalCard(type, id)) {
      document.type = type;
      document.id = id;
    }
    this.models.push(document);
  }
}

function filterAllows(filter: todo, name: string) {
  return (
    !filter ||
    !filter.only ||
    filter.only.length === 0 ||
    (Array.isArray(filter.only[0]) && filter.only[0].includes(name)) ||
    name === filter.only[0]
  );
}

function nextFilter(filter: todo) {
  if (!filter || !filter.only || filter.only.length < 2) {
    return null;
  }
  return { only: filter.only.slice(1) };
}
