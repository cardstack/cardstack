import Service from '@ember/service';
import { inject as service } from '@ember/service';
import { UnsavedCard, CardId, Card, AddressableCard, asCardId } from '@cardstack/core/card';
import { CardstackSession } from './cardstack-session';
import { SingleResourceDoc, CollectionResourceDoc } from 'jsonapi-typescript';
import { CardInstantiator } from '@cardstack/core/card-instantiator';
import { ModuleLoader } from '@cardstack/core/module-loader';
import { Container as ContainerInterface } from '@cardstack/core/container';
import { Factory } from '@cardstack/core/container';
import { CardReader } from '@cardstack/core/card-reader';
import { loadModule } from '../utils/scaffolding';
import { Query } from '@cardstack/core/query';
import { stringify } from 'qs';

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
    let url = this.localURL(card as CardId);
    let response = await fetch(url, {
      method: card.csId != null ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
      },
      body: JSON.stringify((await card.asUpstreamDoc()).jsonapi),
    });

    let json = (await response.json()) as SingleResourceDoc;

    if (!response.ok) {
      throw new Error(`Cannot save card ${response.status}: ${response.statusText} - ${JSON.stringify(json)}`);
    }

    return await this.instantiate(json);
  }

  async delete(card: AddressableCard): Promise<void> {
    let url = this.localURL(card as CardId);
    let {
      data: { meta = {} },
    } = await card.serializeAsJsonAPIDoc({});
    let { version } = meta;

    await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/vnd.api+json',
        'If-Match': String(version || ''),
      },
    });
  }

  async load(idOrURL: CardId | string): Promise<AddressableCard> {
    let id = asCardId(idOrURL);
    // TODO This is loading "everything", with no occlusion. We should settle on
    // a sane level of occusion.
    let url = this.localURL(id);
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

  async search(query: Query): Promise<AddressableCard[]> {
    // TODO This is loading "everything", with no occlusion. We should settle on
    // a sane level of occusion.
    let response = await fetch(`${this.hubURL}/api/cards?${stringify(query)}`, {
      headers: {
        'Content-Type': 'application/vnd.api+json',
      },
    });
    let { data: cards } = (await response.json()) as CollectionResourceDoc;
    return await Promise.all(cards.map(data => this.instantiate({ data })));
  }

  private localURL(csRealm: string, csOriginalRealm?: string): string;
  private localURL(id: CardId): string;
  private localURL(idOrCsRealm: CardId | string, csOriginalRealm?: string): string {
    let csRealm: string | undefined, csId: string | undefined;
    if (typeof idOrCsRealm === 'string') {
      csRealm = idOrCsRealm;
    } else {
      ({ csRealm, csId, csOriginalRealm } = idOrCsRealm);
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
    if (csId != null) {
      url = `${url}/${encodeURIComponent(csId)}`;
    }
    return url;
  }
}

class Reader implements CardReader {
  constructor(private dataService: DataService) {}

  async get(id: CardId): Promise<AddressableCard>;
  async get(canonicalURL: string): Promise<AddressableCard>;
  async get(idOrURL: CardId | string): Promise<AddressableCard> {
    // TODO: this goes to the server, we'll eventually want to do something
    // smarter here, like return any supplied included resources that were
    // passed into the Card.
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
