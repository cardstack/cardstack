const { promisify } = require('util');
const mkdirp = promisify(require('mkdirp'));
const filenamifyUrl = require('filenamify-url');
const { existsSync } = require('fs');
const rimraf = promisify(require('rimraf'));
const { join } = require('path');
const { Clone, Cred, Merge, Repository } = require('nodegit');
const { tmpdir } = require('os');

class GitLocalCache {
  constructor() {
    this.clearCache();
  }

  clearCache() {
    this._remotes = new Map();
  }

  async getRepo(remoteUrl, remote) {
    let existingRepo = this._remotes.get(remoteUrl);

    if (existingRepo) {
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

  async _makeRepo(remote) {
    let cacheDirectory = remote.cacheDir;

    if (!cacheDirectory) {
      cacheDirectory = join(tmpdir(), 'cardstack-git-local-cache');

      if(!existsSync(cacheDirectory)) {
        await mkdirp(cacheDirectory);
      }
    }

    let repoPath = join(cacheDirectory, filenamifyUrl(remote.url));

    let fetchOpts = {
      callbacks: {
        credentials: (url, userName) => {
          if (remote.privateKey) {
            return Cred.sshKeyMemoryNew(userName, remote.publicKey || '', remote.privateKey, remote.passphrase || '');
          }
          return Cred.sshKeyFromAgent(userName);
        }
      }
    };

    let repo;

    if(existsSync(repoPath)) {
      try {
        repo = await Repository.open(repoPath);
      } catch (e) {
        // if opening existing repo fails for any reason we should just delete it and clone it
        await rimraf(repoPath);

        await mkdirp(repoPath);

        repo = await Clone(remote.url, repoPath, {
          fetchOpts
        });
      }
    } else {
      await mkdirp(repoPath);

      repo = await Clone(remote.url, repoPath, {
        fetchOpts
      });
    }

    return {
      repo,
      fetchOpts,
      repoPath
    };
  }

  async pullRepo(remoteUrl, targetBranch) {
    let { repo, fetchOpts } = this._remotes.get(remoteUrl);

    await repo.fetchAll(fetchOpts);
    await repo.mergeBranches(targetBranch, `origin/${targetBranch}`, null, Merge.PREFERENCE.FASTFORWARD_ONLY);
  }
}

module.exports = new GitLocalCache();
