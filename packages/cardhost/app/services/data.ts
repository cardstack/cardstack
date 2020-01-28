import Service from '@ember/service';
import { inject as service } from '@ember/service';
import { UnsavedCard, CardId, Card, AddressableCard, asCardId } from '@cardstack/core/card';
import { CardstackSession } from './cardstack-session';
import { SingleResourceDoc } from 'jsonapi-typescript';
import { CardInstantiator } from '@cardstack/core/card-instantiator';
import { ModuleLoader } from '@cardstack/core/module-loader';
import { Container as ContainerInterface } from '@cardstack/core/container';
import { Factory } from '@cardstack/core/container';
import { OcclusionRulesOrDefaults } from '@cardstack/core/occlusion-rules';
import { CardReader } from '@cardstack/core/card-reader';
import { loadModule } from '../utils/scaffolding';

export default class DataService extends Service implements CardInstantiator {
  @service cardstackSession!: CardstackSession;

  get hubURL(): string {
    return 'http://localhost:3000';
  }

  // TODO glimmer memoizes this, right?
  get reader(): CardReader {
    return new Reader(this);
  }

  // TODO glimmer memoizes this, right?
  get moduleLoader(): ModuleLoader {
    return new Loader();
  }

  // TODO glimmer memoizes this, right?
  get container(): ContainerInterface {
    return new Container();
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
    let { csRealm, csId } = card;
    let doc = await card.asUpstreamDoc();
    let url = csId
      ? `${this.hubURL}/api/realms/${encodeURIComponent(csRealm)}/cards/${encodeURIComponent(csId)}`
      : `${this.hubURL}/api/realms/${encodeURIComponent(csRealm)}/cards`;
    let response = await fetch(url, {
      method: csId ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify(doc),
    });

    let json = (await response.json()) as SingleResourceDoc;

    if (!response.ok) {
      throw new Error(`Cannot save card ${response.status}: ${response.statusText} - ${JSON.stringify(json)}`);
    }

    return await this.instantiate(json);
  }

  // TODO Need to be able to load card's that come from remote realms. How to
  // tell if card's realm is a local realm or a remote realm?
  async load(idOrURL: CardId | string, _occlusionRules?: OcclusionRulesOrDefaults): Promise<AddressableCard> {
    let { csRealm, csId, csOriginalRealm } = asCardId(idOrURL);
    if (!csRealm || !csId) {
      throw new Error(`could not load card ${JSON.stringify(idOrURL)}: missing csRealm and/or csId`);
    }
    let isLocalRealm = csRealm.includes(this.hubURL);
    let requestRealm = isLocalRealm ? csRealm.split('/').pop() : csRealm;
    let url = isLocalRealm
      ? `${this.hubURL}/api/realms/${encodeURIComponent(requestRealm!)}/cards/${encodeURIComponent(csId)}`
      : csOriginalRealm
      ? `${this.hubURL}/api/remote-realms/${encodeURIComponent(requestRealm!)}/cards/${encodeURIComponent(
          csOriginalRealm
        )}/${encodeURIComponent(csId)}`
      : `${this.hubURL}/api/remote-realms/${encodeURIComponent(requestRealm!)}/cards/${encodeURIComponent(csId)}`;

    let response = await fetch(url, {
      headers: {
        'Content-Type': 'application/vnd.api+json',
      },
    });

    let json = (await response.json()) as SingleResourceDoc;
    if (!response.ok) {
      throw new Error(`Cannot load card ${response.status}: ${response.statusText} - ${JSON.stringify(json)}`);
    }
    return await this.instantiate(json);
  }
}

class Reader implements CardReader {
  constructor(private dataService: DataService) {}

  async get(id: CardId): Promise<AddressableCard>;
  async get(canonicalURL: string): Promise<AddressableCard>;
  async get(idOrURL: CardId | string): Promise<AddressableCard> {
    return await this.dataService.load(idOrURL);
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
