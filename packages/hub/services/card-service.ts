import { CompiledCard, RawCard } from '@cardstack/core/src/interfaces';
import { Query } from '@cardstack/core/src/query';
import { inject } from '@cardstack/di';

// This is a placeholder because we haven't built out different per-user
// authorization contexts.
export const INSECURE_CONTEXT = {};

export default class CardServiceFactory {
  realmManager = inject('realm-manager', { as: 'realmManager' });
  builder = inject('card-builder', { as: 'builder' });

  as(requestContext: unknown): CardService {
    return new CardService(requestContext, this.realmManager, this.builder);
  }
}

interface Card {
  data: RawCard['data'];
  compiled: CompiledCard;
}

export class CardService {
  constructor(
    _requestContext: unknown,
    private realmManager: CardServiceFactory['realmManager'],
    private builder: CardServiceFactory['builder']
  ) {}

  async load(url: string): Promise<Card> {
    let rawCard = await this.realmManager.read(url);
    let card = await this.builder.getCompiledCard(url);
    return { data: rawCard.data, compiled: card };
  }

  async create(raw: RawCard): Promise<Card>;
  async create(raw: RawCard | Omit<RawCard, 'url'>, params: { realmURL: string }): Promise<Card>;
  async create(raw: RawCard | Omit<RawCard, 'url'>, params?: { realmURL: string }): Promise<Card> {
    let realmURL: string;
    if (params) {
      if ('url' in raw && !raw.url.startsWith(params.realmURL)) {
        throw new Error(`realm mismatch. You tried to create card ${raw.url} in realm ${params.realmURL}`);
      }
      realmURL = params.realmURL;
    } else {
      if (!('url' in raw)) {
        throw new Error(`you must either choose the card's URL or choose which realmURL it will go into`);
      }
      let realm = this.realmManager.realms.find((r) => raw.url.startsWith(r.url));
      if (!realm) {
        throw new Error(`tried to create card ${raw.url} but we don't have a realm configured that matches that URL`);
      }
      realmURL = realm.url;
    }

    let rawCard = await this.realmManager.getRealm(realmURL).create(raw);
    let compiled = await this.builder.getCompiledCard(rawCard.url);

    // TODO:
    // await updateIndexForThisCardAndEverybodyWhoDependsOnHim()

    return { data: rawCard.data, compiled };
  }

  async update(raw: RawCard): Promise<Card> {
    let originalRaw = await this.realmManager.read(raw.url);
    await this.realmManager.update(Object.assign({}, originalRaw, raw));
    let compiled = await this.builder.getCompiledCard(raw.url);

    // TODO:
    // await updateIndexForThisCardAndEverybodyWhoDependsOnHim()

    return { data: raw.data, compiled };
  }

  query(_query: Query): Promise<Card[]> {
    // Query to sql
    throw new Error('Method not implemented.');
  }

  teardown() {}
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-service': CardServiceFactory;
  }
}
