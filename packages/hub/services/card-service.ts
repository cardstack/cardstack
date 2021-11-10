import { CompiledCard, RawCard } from '@cardstack/core/src/interfaces';
import { Filter, Query } from '@cardstack/core/src/query';
import { inject } from '@cardstack/di';
import { Expression, expressionToSql, param } from '../utils/expressions';

// This is a placeholder because we haven't built out different per-user
// authorization contexts.
export const INSECURE_CONTEXT = {};

export default class CardServiceFactory {
  private realmManager = inject('realm-manager', { as: 'realmManager' });
  private builder = inject('card-builder', { as: 'builder' });
  private searchIndex = inject('searchIndex');
  private db = inject('database-manager', { as: 'db' });

  as(requestContext: unknown): CardService {
    return new CardService(requestContext, this.realmManager, this.builder, this.searchIndex, this.db);
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
    private builder: CardServiceFactory['builder'],
    private searchIndex: CardServiceFactory['searchIndex'],
    private db: CardServiceFactory['db']
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

    let rawCard = await this.realmManager.getRealmForCard(realmURL).create(raw);
    let compiled = await this.searchIndex.indexCard(rawCard);

    return { data: rawCard.data, compiled };
  }

  async update(raw: RawCard): Promise<Card> {
    await this.realmManager.update(Object.assign({}, raw, raw));
    let compiled = await this.builder.getCompiledCard(raw.url);

    // TODO:
    // await updateIndexForThisCardAndEverybodyWhoDependsOnHim()

    return { data: raw.data, compiled };
  }

  async query(query: Query): Promise<Card[]> {
    let client = await this.db.getPool();
    try {
      // Query to sql
      let expression: Expression = ['select data from cards'];
      if (query.filter) {
        expression = [...expression, 'where', ...filterToExpression(query.filter)];
      }
      let sql = expressionToSql(expression);
      let result = await client.query(expressionToSql(expression));
      console.log(result);
    } finally {
      client.release();
    }
  }

  teardown() {}
}

function filterToExpression(filter: Filter): Expression {
  if ('any' in filter) {
    throw unimpl('any');
  }
  if ('every' in filter) {
    throw unimpl('every');
  }
  if ('not' in filter) {
    throw unimpl('not');
  }
  if ('eq' in filter) {
    throw unimpl('eq');
  }
  if ('range' in filter) {
    throw unimpl('range');
  }

  return [param(filter.type), '= ANY (ancestors)'];
}

function unimpl(which: string) {
  new Error(`unimpl ${which}`);
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-service': CardServiceFactory;
  }
}
