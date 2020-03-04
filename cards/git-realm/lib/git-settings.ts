interface IndexerSettings {
  repo: string;
  basePath: string;
  branchPrefix: string;
  remote?: RemoteConfig;
}
import { RemoteConfig } from './git';

import CardstackError from '@cardstack/core/error';
import { AddressableCard } from '@cardstack/core/card';

export async function extractSettings(realmCard: AddressableCard): Promise<IndexerSettings> {
  let repo = await realmCard.value('repo');

  if (typeof repo != 'string') {
    throw new CardstackError('You must provide a repo attribute when instantiating the git realm card');
  }

  let branchPrefix = (await realmCard.value('branch')) ?? '';
  let basePath = (await realmCard.value('basePath')) ?? undefined;

  // TODO: handle remote config
  // if (typeof attributes.remote == 'object' && attributes.remote.url && attributes.remote.cacheDir) {
  //   this.remote = attributes.remote;
  // }
  // if (repo && remote) {
  //   throw new Error("You cannot define the params 'remote' and 'repo' at the same time for this data source");
  // }

  return {
    repo,
    branchPrefix,
    basePath,
  };
}
