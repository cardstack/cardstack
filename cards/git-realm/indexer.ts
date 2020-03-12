import { Repository, Commit, RemoteConfig, RepoNotFound } from './lib/git';
import Tree, { TreeEntry } from './lib/tree';

import Change from './lib/change';
import logger from '@cardstack/logger';
const log = logger('cardstack/git/indexer');
import service from './lib/service';

const defaultBranch = 'master';

import { Indexer, IndexingOperations } from '@cardstack/core/indexer';
import { UpstreamDocument } from '@cardstack/core/document';
import { AddressableCard } from '@cardstack/core/card';
import { extractSettings } from './lib/git-settings';

interface GitMeta {
  commit?: string;
}

type PathSpec = string | string[];

export default class GitIndexer implements Indexer<GitMeta> {
  repoPath?: string;
  basePath: PathSpec[] = [];
  branchPrefix = '';
  remote?: RemoteConfig;
  repo?: Repository;

  constructor(private realmCard: AddressableCard) {}

  async ready(): Promise<void> {
    let settings = await extractSettings(this.realmCard);
    this.repoPath = settings.repo;
    this.basePath = settings.basePath ? settings.basePath.split('/') : [];
    this.branchPrefix = settings.branchPrefix;
    this.remote = settings.remote;
  }

  async update(meta: GitMeta, ops: IndexingOperations) {
    log.debug(`starting update()`);
    await this.ensureRepo();

    let targetBranch = this.branchPrefix + defaultBranch;

    if (this.remote) {
      await service.pullRepo(this.remote.url, targetBranch);
    }

    let updater = new GitUpdater(this.repo!, targetBranch, this.basePath);

    let result = await updater.updateContent(meta, ops);
    log.debug(`ending update()`);
    return result;
  }

  private async ensureRepo() {
    if (!this.repo) {
      if (this.remote) {
        log.info('Getting remote repo for %s from service', this.remote.url);
        this.repo = await service.getRepo(this.remote.url, this.remote);
        return;
      }

      try {
        this.repo = await Repository.open(this.repoPath!);
      } catch (e) {
        if (e instanceof RepoNotFound) {
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
}

// );

class GitUpdater {
  commit?: Commit;
  commitId?: string;
  rootTree?: Tree;

  constructor(readonly repo: Repository, readonly branch: string, readonly basePath: PathSpec[]) {}

  async updateContent(meta: GitMeta, ops: IndexingOperations) {
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
      this.commitId = this.commit.sha();
    }
    if (!this.rootTree) {
      this.rootTree = await this.commit.getTree();
    }
  }

  async _commitAtBranch(branchName: string) {
    let branch = await this.repo.lookupLocalBranch(branchName);
    return Commit.lookup(this.repo, branch.target());
  }

  async _indexTree(ops: IndexingOperations, oldTree?: Tree, newTree?: Tree, filter?: Filter | null) {
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

  async _indexEntry(
    ops: IndexingOperations,
    name: string,
    oldTree: Tree | undefined,
    newEntry: TreeEntry,
    filter?: Filter | null
  ) {
    let oldEntry;
    if (oldTree) {
      oldEntry = oldTree.entryByName(name);
      if (oldEntry && oldEntry.id() && oldEntry.id()!.equal(newEntry.id()!)) {
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
      let { id } = identify(newEntry);
      let doc = await this._entryToDoc(newEntry);
      if (doc) {
        await ops.save(id, doc);
      }
    }
  }

  async _deleteEntry(ops: IndexingOperations, oldEntry: TreeEntry, filter?: Filter | null) {
    if (oldEntry.isTree()) {
      await this._indexTree(ops, await oldEntry.getTree(), undefined, nextFilter(filter));
    } else {
      let { id } = identify(oldEntry);
      await ops.delete(id);
    }
  }

  async _entryToDoc(entry: TreeEntry): Promise<UpstreamDocument | undefined> {
    entry.isBlob();
    let contents = (await entry.getBlob()).content().toString('utf8');
    let doc;
    try {
      doc = JSON.parse(contents);
    } catch (err) {
      log.warn('Ignoring record with invalid json at %s', entry.path());
      return;
    }
    return new UpstreamDocument(doc);
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

  id = decodeURIComponent(id);

  return { type, id };
}

interface Filter {
  only: PathSpec | PathSpec[];
}

function filterAllows(filter: Filter | null | undefined, name: string) {
  return (
    !filter ||
    !filter.only ||
    filter.only.length === 0 ||
    (Array.isArray(filter.only[0]) && filter.only[0].includes(name)) ||
    name === filter.only[0]
  );
}

function nextFilter(filter: Filter | undefined | null) {
  if (!filter || !filter.only || filter.only.length < 2) {
    return null;
  }
  return { only: filter.only.slice(1) };
}
