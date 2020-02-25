import Service from '@ember/service';
import { inject as service } from '@ember/service';
import { UnsavedCard, Card, AddressableCard } from '@cardstack/core/card';
import { CardId, asCardId, canonicalURL } from '@cardstack/core/card-id';
import { CardstackSession } from './cardstack-session';
import { SingleResourceDoc, CollectionResourceDoc, DocWithErrors } from 'jsonapi-typescript';
import { CardInstantiator } from '@cardstack/core/card-instantiator';
import { ModuleLoader } from '@cardstack/core/module-loader';
import { Container as ContainerInterface } from '@cardstack/core/container';
import { Factory } from '@cardstack/core/container';
import { CardReader } from '@cardstack/core/card-reader';
import { loadModule } from '../utils/scaffolding';
import { Query } from '@cardstack/core/query';
import { stringify } from 'qs';
import CardstackError from '@cardstack/core/error';
import { OcclusionRules } from '@cardstack/core/occlusion-rules';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

// Caching at the module scope to help speed up the tests. Since this is a
// singleton anyways, that should be ok.
const cache: Map<string, Promise<AddressableCard>> = new Map();

export default class DataService extends Service implements CardInstantiator {
  @service cardstackSession!: CardstackSession;
  private memoizeCache: { [functionName: string]: any } = {};

  get hubURL(): string {
    return 'http://localhost:3000';
  }

  // some day we'll have a @memo decorator. until then, here's some real basic memoization...
  get reader(): CardReader {
    return this.getMemoizedValue<Reader>('reader', () => new Reader(this));
  }
  get moduleLoader(): ModuleLoader {
    return this.getMemoizedValue<Loader>('moduleLoader', () => new Loader());
  }
  get container(): ContainerInterface {
    return this.getMemoizedValue<Container>('container', () => new Container());
  }

  async instantiate(jsonapi: SingleResourceDoc, imposeIdentity?: CardId): Promise<AddressableCard> {
    // TODO need to instantiate this from the container
    return new AddressableCard(jsonapi, this.reader, this.moduleLoader, this.container, imposeIdentity);
  }

  async create(realm: string, doc: SingleResourceDoc): Promise<UnsavedCard> {
    // TODO need to instantiate this from the container
    return new UnsavedCard(doc, realm, this.reader, this.moduleLoader, this.container, this);
  }

  async save(card: UnsavedCard | AddressableCard): Promise<AddressableCard> {
    let url = this.localURL(card);
    let response = await fetch(url, {
      method: 'isUnsaved' in card ? 'POST' : 'PATCH',
      headers: {
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify((await card.asUpstreamDoc()).jsonapi),
    });
    if (!response.ok) {
      await handleJsonApiError(response);
    }

    let json = (await response.json()) as SingleResourceDoc;
    return await this.instantiate(json);
  }

  async delete(card: AddressableCard): Promise<void> {
    let url = this.localURL(card);
    let version = card.meta?.version || '';

    let response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'If-Match': String(version),
      },
    });
    if (!response.ok) {
      await handleJsonApiError(response);
    }
  }

  async load(idOrURL: CardId | string, rules: OcclusionRules | 'everything'): Promise<AddressableCard> {
    let id = asCardId(idOrURL);
    let cardURL = canonicalURL(id);

    let isBuiltInCard =
      id.csRealm === CARDSTACK_PUBLIC_REALM && (!id.csOriginalRealm || id.csOriginalRealm === CARDSTACK_PUBLIC_REALM);

    let url = this.localURL(id);
    if (rules !== 'everything') {
      url = `${url}?${stringify(rules)}`;
    }

    if (isBuiltInCard && cache.has(cardURL)) {
      return (await cache.get(cardURL))!;
    }

    let cardPromise = new Promise<AddressableCard>(async (resolve, reject) => {
      let response = await fetch(url, {
        headers: {
          'Content-Type': 'application/vnd.api+json',
        },
      });
      if (!response.ok) {
        reject(response);
      } else {
        let json = (await response.json()) as SingleResourceDoc;
        resolve(await this.instantiate(json));
      }
    });
    if (isBuiltInCard) {
      cache.set(cardURL, cardPromise);
    }
    let result: AddressableCard;
    try {
      result = await cardPromise;
    } catch (err) {
      await handleJsonApiError(err);
    }
    return result!; // if there is no card we throw 404 above, so by this point there will always be a card
  }

  async search(query: Query, rules: OcclusionRules | 'everything'): Promise<AddressableCard[]> {
    let url = `${this.hubURL}/api/cards?${stringify(query)}`;
    if (rules !== 'everything') {
      url = `${url}&${stringify(rules)}`;
    }
    let response = await fetch(url, {
      headers: {
        'Content-Type': 'application/vnd.api+json',
      },
    });
    if (!response.ok) {
      await handleJsonApiError(response);
    }
    let { data: cards } = (await response.json()) as CollectionResourceDoc;
    return await Promise.all(cards.map(data => this.instantiate({ data })));
  }

  private localURL(csRealm: string, csOriginalRealm?: string): string;
  private localURL(id: CardId): string;
  private localURL(card: Card): string;
  private localURL(idOrCardOrCsRealm: Card | CardId | string, csOriginalRealm?: string): string {
    let csRealm: string | undefined, csId: string | undefined;
    if (idOrCardOrCsRealm instanceof Card) {
      ({ csRealm, csId, csOriginalRealm } = idOrCardOrCsRealm);
    }
    if (typeof idOrCardOrCsRealm === 'string') {
      csRealm = idOrCardOrCsRealm;
    } else {
      ({ csRealm, csId, csOriginalRealm } = idOrCardOrCsRealm);
    }
    if (csRealm == null) {
      throw new Error(`Must specify a csRealm either as a string or as part of a CardId`);
    }

    let isLocalRealm = csRealm.includes(this.hubURL);
    let requestRealm = isLocalRealm ? csRealm.split('/').pop() : csRealm;
    let url = isLocalRealm
      ? `${this.hubURL}/api/realms/${encodeURIComponent(requestRealm!)}/cards`
      : csOriginalRealm
      ? `${this.hubURL}/api/remote-realms/${encodeURIComponent(requestRealm!)}/cards/${encodeURIComponent(
          csOriginalRealm
        )}`
      : `${this.hubURL}/api/remote-realms/${encodeURIComponent(requestRealm!)}/cards`;
    if (csId != null && typeof idOrCardOrCsRealm !== 'string' && !('isUnsaved' in idOrCardOrCsRealm)) {
      url = `${url}/${encodeURIComponent(csId)}`;
    }
    return url;
  }

  private getMemoizedValue<T>(fnName: string, fn: () => T): T {
    if (this.memoizeCache[fnName] === undefined) {
      this.memoizeCache[fnName] = fn();
    }
    return this.memoizeCache[fnName];
  }
}

async function handleJsonApiError(response: Response) {
  let jsonapiError = (await response.json()) as DocWithErrors;
  let detail = jsonapiError.errors.length ? jsonapiError.errors[0].detail : JSON.stringify(jsonapiError);
  throw new CardstackError(detail!, { status: response.status });
}

class Reader implements CardReader {
  constructor(private dataService: DataService) {}

  async get(id: CardId): Promise<AddressableCard>;
  async get(canonicalURL: string): Promise<AddressableCard>;
  async get(idOrURL: CardId | string): Promise<AddressableCard> {
    // TODO: this goes to the server, we'll eventually want to do something
    // smarter here, like return any supplied included resources that were
    // passed into the Card. And if the subsequent loads occur, they may
    // overfetch a resource that is needed in a different get for this
    // card--let's harness any over fetching efficiently.
    return await this.dataService.load(idOrURL, 'everything');
  }
}

class Loader implements ModuleLoader {
  async load(card: Card, localModulePath: string, exportedName?: string): Promise<any> {
    return loadModule(card, localModulePath, exportedName);
  }
}

class Container implements ContainerInterface {
  async instantiate<T, A extends unknown[]>(factory: Factory<T, A>, ...args: A): Promise<T> {
    return new factory(...args); // TODO instantiate from the container
  }
}
