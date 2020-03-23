interface IndexerSettings {
  repo?: string;
  basePath: string;
  branchPrefix: string;
  remote?: RemoteConfig;
}
import { RemoteConfig } from './git';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirp } from 'fs-extra';

import { Error } from '@cardstack/hub';
import { AddressableCard } from '@cardstack/hub';

export async function extractSettings(realmCard: AddressableCard): Promise<IndexerSettings> {
  // In order to allow git realm cards to be portable, let's let the hub decide
  // where the repo dir, as the root dir in one hub may not exist in another hub.
  const repoRootDir = process.env.REPO_ROOT_DIR || join(homedir(), '.cardstack');
  let repo = (await realmCard.value('repo')) ?? undefined;
  let remoteUrl = (await realmCard.value('remoteUrl')) ?? undefined;
  let remoteCacheDir = (await realmCard.value('remoteCacheDir')) ?? undefined;
  let branchPrefix = (await realmCard.value('branch')) ?? '';
  let basePath = (await realmCard.value('basePath')) ?? undefined;

  let remote: RemoteConfig | undefined;

  if (repo) {
    repo = join(repoRootDir, repo);
    await mkdirp(repo);
  }

  if (remoteUrl) {
    if (!remoteCacheDir) {
      throw new Error('You must provide a remoteCacheDir for remote repo config');
    }

    remote = {
      url: remoteUrl,
      cacheDir: join(repoRootDir, remoteCacheDir),
    };
    await mkdirp(remote.cacheDir);
  }
  if (repo && (remoteUrl || remoteCacheDir)) {
    throw new Error('You cannot define the repo param with either the remoteUrl param or the remoteCacheDir param');
  }

  if (!repo && !remote) {
    throw new Error('You must define a repo or a remoteUrl when configuring the git realm card');
  }

  return {
    repo,
    branchPrefix,
    basePath,
    remote,
  };
}
