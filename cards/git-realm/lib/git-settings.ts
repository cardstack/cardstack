interface IndexerSettings {
  repo: string;
  basePath: string;
  branchPrefix: string;
  remote?: RemoteConfig;
}
import { RemoteConfig } from './git';

import CardstackError from '@cardstack/core/error';
import { AddressableCard } from '@cardstack/core/card';

export function extractSettings(realmCard: AddressableCard): IndexerSettings {
  let attributes = realmCard.attributes;

  if (!attributes) {
    throw new CardstackError('You must provide attributes to configure the git realm card');
  }

  let repo;

  if (typeof attributes.repo == 'string') {
    repo = await realmCard.value('repo');
  } else {
    throw new CardstackError('You must provide a repo attribute when instantiating the git realm card');
  }

  let branchPrefix = (attributes.branch ?? '') as string;
  let basePath = (attributes.basePath as string) ?? undefined;

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
