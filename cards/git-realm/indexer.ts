import { Repository, Commit, RemoteConfig, RepoNotFound } from './lib/git';
import Tree, { TreeEntry } from './lib/tree';

import Change from './lib/change';
import logger from '@cardstack/logger';
const log = logger('cardstack/git/indexer');
import service from './lib/service';

const defaultBranch = 'master';

import { Indexer, IndexingOperations } from '@cardstack/hub';
import { AddressableCard, Card } from '@cardstack/hub';
import { extractSettings } from './lib/git-settings';
import { assertSingleResourceDoc } from '@cardstack/core/jsonapi';
import { SingleResourceDoc } from 'jsonapi-typescript';
import merge from 'lodash/merge';
import { UpstreamDocument, UpstreamIdentity } from '@cardstack/hub';
import { inDependencyOrder } from '@cardstack/hub';

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

    let updater = new GitUpdater(this.realmCard, this.repo!, targetBranch, this.basePath);

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

class GitUpdater {
  commit?: Commit;
  commitId?: string;
  rootTree?: Tree;
  docsToIndex: Map<SingleResourceDoc, UpstreamIdentity> = new Map();

  constructor(
    readonly realmCard: AddressableCard,
    readonly repo: Repository,
    readonly branch: string,
    readonly basePath: PathSpec[]
  ) {}

  async updateContent(meta: GitMeta, ops: IndexingOperations) {
    log.debug(`starting updateContent()`);
    await this.loadCommit();
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
    await this.findEntriesToIndex(ops, originalTree, this.rootTree, {
      only: this.basePath.concat([['cards']]),
    });

    let docsInOrder = inDependencyOrder([...this.docsToIndex.keys()], this.realmCard.csId);
    for (let doc of docsInOrder) {
      let upstreamId = this.docsToIndex.get(doc);
      await ops.save(upstreamId!, new UpstreamDocument(doc));
    }

    if (!originalTree) {
      await ops.finishReplaceAll();
    }
    log.debug(`completed updateContent()`);
    return {
      commit: this.commitId,
    };
  }

  private async loadCommit() {
    if (!this.commit) {
      this.commit = await this.commitAtBranch(this.branch);
      this.commitId = this.commit.sha();
    }
    if (!this.rootTree) {
      this.rootTree = await this.commit.getTree();
    }
  }

  private async commitAtBranch(branchName: string) {
    let branch = await this.repo.lookupLocalBranch(branchName);
    return Commit.lookup(this.repo, branch.target());
  }

  private async findEntriesToIndex(ops: IndexingOperations, oldTree?: Tree, newTree?: Tree, filter?: Filter | null) {
    let seen = new Map();
    if (newTree) {
      for (let newEntry of newTree.entries()) {
        let name = newEntry.name();
        if (!filterAllows(filter, name)) {
          continue;
        }
        seen.set(name, true);
        await this.collectEntriesToIndex(ops, name, oldTree, newEntry, filter);
      }
    }
    if (oldTree) {
      for (let oldEntry of oldTree.entries()) {
        let name = oldEntry.name();
        if (!filterAllows(filter, name)) {
          continue;
        }
        if (!seen.get(name)) {
          await this.deleteEntry(ops, oldEntry, filter);
        }
      }
    }
  }

  private async collectEntriesToIndex(
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
    if (newEntry.isTree() && (await newEntry.getTree()).entryByName('card.json')) {
      let cardTree = await newEntry.getTree();
      let cardEntries = await this.crawlCard(cardTree);
      // Let's re-index this card since something is different (otherwise the
      // pruning above would have recocognized that the card subtree was
      // unchanged).
      let json = await this.assembleCard(cardTree, cardEntries);
      let upstreamId = {
        csId: json.data.attributes!.csId as string,
        csOriginalRealm: json.data.attributes!.csOriginalRealm as string,
      };
      this.docsToIndex.set(json, upstreamId);
    } else if (newEntry.isTree()) {
      await this.findEntriesToIndex(
        ops,
        oldEntry && oldEntry.isTree() ? await oldEntry.getTree() : undefined,
        await newEntry.getTree(),
        nextFilter(filter)
      );
    }
  }

  private async deleteEntry(ops: IndexingOperations, oldEntry: TreeEntry, filter?: Filter | null) {
    if (oldEntry.isTree() && (await oldEntry.getTree()).entryByName('card.json')) {
      let cardTree = await oldEntry.getTree();
      let json = await entryToDoc(cardTree.entryByName('card.json')!);
      if (json?.data.attributes) {
        await ops.delete(json.data.attributes as UpstreamIdentity);
      }
    } else if (oldEntry.isTree()) {
      await this.findEntriesToIndex(ops, await oldEntry.getTree(), undefined, nextFilter(filter));
    }
  }

  private async crawlCard(cardTree: Tree): Promise<Map<string, Entry>> {
    let output: Map<string, Entry> = new Map();
    for (let entry of cardTree.entries()) {
      if (entry.isTree()) {
        output.set(entry.path(), await this.crawlCard(await entry.getTree()));
      } else {
        output.set(entry.path(), entry);
      }
    }
    return output;
  }

  private async assembleCard(cardTree: Tree, files: Map<string, Entry>): Promise<SingleResourceDoc> {
    let pkgEntry = cardTree.entryByName('package.json');
    if (!pkgEntry || !pkgEntry.isBlob()) {
      throw new Error(`Card is missing package.json file`);
    }
    let pkgContents = await entryToString(pkgEntry);
    if (!pkgContents) {
      throw new Error(`Card has empty package.json file`);
    }
    let pkg = JSON.parse(pkgContents);

    let cardJsonEntry = cardTree.entryByName('card.json');
    if (!cardJsonEntry || !cardJsonEntry.isBlob()) {
      throw new Error(`Card is missing card.json file`);
    }
    let json;
    try {
      json = await entryToDoc(cardJsonEntry);
    } catch (err) {
      if ('isCardstackError' in err) {
        throw new Error(`card.json is invalid because: ${err}`);
      }
      throw err;
    }
    if (!json) {
      throw new Error(`card.json is empty`);
    }

    // ensure we have an attributes object
    merge(json, {
      data: {
        attributes: {},
      },
    });

    // then ensure that csFiles reflects our true on disk files only
    json.data.attributes!.csFiles = await loadFiles(cardTree, '', files, ['package.json', 'card.json']);

    // and our peerDeps match the ones from package.json
    // @ts-ignore
    json.data.attributes!.csPeerDependencies = pkg.peerDependencies;
    return json;
  }
}

type Entry = TreeEntry | Map<string, Entry>;

async function loadFiles(
  cardTree: Tree,
  subDirectory: string,
  files: Map<string, Entry>,
  exclude: string[] = []
): Promise<NonNullable<Card['csFiles']>> {
  let output: NonNullable<Card['csFiles']> = Object.create(null);
  let cardDir = cardTree.path();
  for (let [name, entry] of files) {
    let csFileName = name.slice(cardDir.length + subDirectory.length + 1);
    if (exclude.includes(csFileName)) {
      continue;
    }
    if (entry instanceof Map) {
      output[csFileName] = await loadFiles(cardTree, `${subDirectory}/${csFileName}`, entry);
    } else {
      output[csFileName] = (await entryToString(entry)) || '';
    }
  }
  return output;
}

async function entryToString(entry: TreeEntry): Promise<string | undefined> {
  if (entry.isBlob()) {
    return Buffer.from((await entry.getBlob()).content()).toString('utf8');
  }
}
async function entryToDoc(entry: TreeEntry): Promise<SingleResourceDoc | undefined> {
  let contents = await entryToString(entry);
  if (contents == null) {
    return;
  }

  let json = JSON.parse(contents);
  assertSingleResourceDoc(json);
  return json;
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
