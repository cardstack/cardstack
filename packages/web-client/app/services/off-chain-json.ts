import Service from '@ember/service';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';
import { fetchOffChainJson } from '../utils/fetch-off-chain-json';

export default class OffChainJsonService extends Service {
  #didResolver = new Resolver(getResolver());
  #cache: Map<string, any> = new Map();

  async fetch(did: string | undefined, waitForResource = false): Promise<any> {
    if (!did) {
      throw new Error('did is required to fetch off chain json');
    }

    if (this.#cache.has(did)) {
      let jsonApiDocument = this.#cache.get(did);
      return Promise.resolve(jsonApiDocument);
    }

    let jsonApiDocument = await this.fetchWithoutCaching(did, waitForResource);
    if (jsonApiDocument) {
      this.#cache.set(did, jsonApiDocument);
      return jsonApiDocument;
    }
  }

  async fetchWithoutCaching(
    did: string,
    waitForResource = false
  ): Promise<any> {
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
