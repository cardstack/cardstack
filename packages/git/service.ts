import { Merge, Repository, Reset, RemoteConfig, FetchOptions } from './git';

import { promisify } from 'util';
import mkdirpcb from 'mkdirp';
const mkdirp = promisify(mkdirpcb);

import filenamifyUrl from 'filenamify-url';
import { existsSync } from 'fs';
import rimrafcb from 'rimraf';
const rimraf = promisify(rimrafcb);
import { join } from 'path';
import { tmpdir } from 'os';
import logger from '@cardstack/logger';
const log = logger('cardstack/git');

interface RemoteCache {
  repo: Repository;
  fetchOpts: FetchOptions;
  repoPath: string;
}

class GitLocalCache {
  private _remotes: Map<string, RemoteCache> = new Map();

  clearCache() {
    this._remotes = new Map();
  }

  async getRepo(remoteUrl: string, remote: RemoteConfig) {
    let existingRepo = this._remotes.get(remoteUrl);

    if (existingRepo) {
      log.info('existing repo found for %s, reusing it from the cache', remoteUrl);
      return existingRepo.repo;
    }

    let { repo, fetchOpts, repoPath } = await this._makeRepo(remote);

    this._remotes.set(remote.url, {
      repo,
      fetchOpts,
      repoPath,
    });

    return repo;
  }

  async _makeRepo(remote: RemoteConfig) {
    let cacheDirectory = remote.cacheDir;

    if (!cacheDirectory) {
      cacheDirectory = join(tmpdir(), 'cardstack-git-local-cache');

      if (!existsSync(cacheDirectory)) {
        await mkdirp(cacheDirectory);
      }
    }

    let repoPath = join(cacheDirectory, filenamifyUrl(remote.url));

    let fetchOpts = remote.privateKey
      ? FetchOptions.privateKey(remote.privateKey, remote.publicKey, remote.passphrase)
      : FetchOptions.agentKey();

    log.info('creating local repo cache for %s in %s', remote.url, repoPath);

    let repo;

    if (existsSync(repoPath)) {
      try {
        log.info('repo already exists - reusing local clone');
        repo = await Repository.open(repoPath);
      } catch (e) {
        log.info('creating repo from %s failed, deleting and recloning', repoPath);
        // if opening existing repo fails for any reason we should just delete it and clone it
        await rimraf(repoPath);

        await mkdirp(repoPath);

        repo = await Repository.clone(remote.url, repoPath);
      }
    } else {
      log.info('cloning %s into %s', remote.url, repoPath);
      await mkdirp(repoPath);

      repo = await Repository.clone(remote.url, repoPath);
    }

    return {
      repo,
      fetchOpts,
      repoPath,
    };
  }

  async fetchAllFromRemote(remoteUrl: string) {
    let { repo, fetchOpts } = this._remotes.get(remoteUrl)!;
    return await repo.fetchAll(fetchOpts);
  }

  async pullRepo(remoteUrl: string, targetBranch: string) {
    log.info('pulling changes for branch %s on %s', targetBranch, remoteUrl);
    let { repo } = this._remotes.get(remoteUrl)!;

    // if branch does not exist locally then create it and reset to head of remote
    // this is required because node git doesn't support direct pull https://github.com/nodegit/nodegit/issues/1123
    try {
      await repo.getReference(`${targetBranch}`);
      log.info('reference for %s on %s already exists, continuing', targetBranch, remoteUrl);
    } catch (e) {
      if (e.message.startsWith('no reference found for shorthand')) {
        log.info('no local branch for %s on %s. Creating it now...', targetBranch, remoteUrl);
        let headCommit = await repo.getHeadCommit();
        let ref = await repo.createBranch(targetBranch, headCommit, false);
        await repo.checkoutBranch(ref);
        let remoteCommit = await repo.getReferenceCommit(`refs/remotes/origin/${targetBranch}`);
        Reset.hardReset(repo, remoteCommit);
      } else {
        throw e;
      }
    }

    await repo.mergeBranches(targetBranch, `origin/${targetBranch}`, null, Merge.FASTFORWARD_ONLY);
  }
}

const singleton = new GitLocalCache();
export default singleton;
module.exports = singleton;
