interface IndexerSettings {
  repo?: string;
  basePath: string;
  branchPrefix: string;
  remote?: RemoteConfig;
}
import { RemoteConfig } from './git';

import CardstackError from '@cardstack/core/error';
import { AddressableCard } from '@cardstack/core/card';

export async function extractSettings(realmCard: AddressableCard): Promise<IndexerSettings> {
  let repo = (await realmCard.value('repo')) ?? undefined;
  let remoteUrl = (await realmCard.value('remoteUrl')) ?? undefined;
  let remoteCacheDir = (await realmCard.value('remoteCacheDir')) ?? undefined;
  let branchPrefix = (await realmCard.value('branch')) ?? '';
  let basePath = (await realmCard.value('basePath')) ?? undefined;

  let remote: RemoteConfig | undefined;

  if (remoteUrl) {
    if (!remoteCacheDir) {
      throw new CardstackError('You must provide a remoteCacheDir for remote repo config');
    }

    remote = {
      url: remoteUrl,
      cacheDir: remoteCacheDir,
    };
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
