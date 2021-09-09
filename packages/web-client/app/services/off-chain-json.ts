import Service from '@ember/service';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';
import { fetchOffChainJson } from '../utils/fetch-off-chain-json';

export default class OffChainJsonService extends Service {
  #didResolver = new Resolver(getResolver());

  async fetch(did: string, waitForResource = false): Promise<any> {
    let didResult = await this.#didResolver.resolve(did);
    let alsoKnownAs = didResult?.didDocument?.alsoKnownAs;

    if (alsoKnownAs) {
      let jsonApiDocument = await fetchOffChainJson(
        alsoKnownAs[0],
        waitForResource
      );
      return jsonApiDocument;
    }
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'off-chain-json': OffChainJsonService;
  }
}
