import { CompiledCard, RawCard } from '@cardstack/core/src/interfaces';
import { RawCardDeserializer } from '@cardstack/core/src/raw-card-deserializer';
import { Filter, Query, TypedFilter } from '@cardstack/core/src/query';
import { inject } from '@cardstack/di';
import { addExplicitParens, any, every, Expression, expressionToSql, param } from '../utils/expressions';

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
    let { raw, compiled } = await this.searchIndex.getCard(url);
    if (!compiled) {
      throw new Error(`bug: database entry for ${raw.url} is missing the compiled card`);
    }
    return { data: raw.data, compiled };
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
      let expression: Expression = ['select data from cards'];
      if (query.filter) {
        expression = [...expression, 'where', ...filterToExpression(query.filter, 'https://cardstack.com/base/base')];
      }
      let result = await client.query<{ data: any }>(expressionToSql(expression));
      let deserializer = new RawCardDeserializer();
      return result.rows.map((row) => {
        let { raw, compiled } = deserializer.deserialize(row.data.data, row.data);
        if (!compiled) {
          throw new Error(`bug: database entry for ${raw.url} is missing the compiled card`);
        }
        return { data: raw.data, compiled };
      });
    } finally {
      client.release();
    }
  }

  teardown() {}
}

function filterToExpression(filter: Filter, parentType: string): Expression {
  if ('type' in filter) {
    return [param(filter.type), '= ANY (ancestors)'];
  }

  let on = filter?.on ?? parentType;

  if ('any' in filter) {
    return any(filter.any.map((expr) => filterToExpression(expr, on)));
  }
  if ('every' in filter) {
    return every(filter.every.map((expr) => filterToExpression(expr, on)));
  }
  if ('not' in filter) {
    return ['NOT', ...addExplicitParens(filterToExpression(filter.not, on))];
  }
  if ('eq' in filter) {
    return typedFilter(
      every(
        Object.entries(filter.eq).map(([fieldPath, value]) => [
          '"searchData" #>>',
          param([on, ...fieldPath.split('.')]),
          'IS NOT DISTINCT FROM',
          param(value),
        ])
      ),
      filter
    );
  }
  throw unimpl('range');
}

function typedFilter(baseExpression: Expression, filter: TypedFilter): Expression {
  if (filter.on) {
    return every([baseExpression, [param(filter.on), '= ANY (ancestors)']]);
  } else {
    return baseExpression;
  }
}

function unimpl(which: string) {
  return new Error(`unimpl ${which}`);
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-service': CardServiceFactory;
  }
}
