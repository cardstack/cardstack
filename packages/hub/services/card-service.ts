import { CompiledCard, NewRawCard, RawCard } from '@cardstack/core/src/interfaces';
import { RawCardDeserializer } from '@cardstack/core/src/raw-card-deserializer';
import { Filter, Query } from '@cardstack/core/src/query';
import { inject } from '@cardstack/di';
import {
  field,
  addExplicitParens,
  any,
  columnName,
  every,
  param,
  CardExpression,
  isField,
  resolveNestedPath,
  expressionToSql,
  Expression,
} from '../utils/expressions';
import { BadRequest } from '@cardstack/core/src/utils/errors';
import { cardURL } from '@cardstack/core/src/utils';

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
      throw new Error(`bug: database entry for ${url} is missing the compiled card`);
    }
    return { data: raw.data, compiled };
  }

  async create(raw: NewRawCard): Promise<Card> {
    // NEW: Compile it to make sure everything is valid
    // `${realm}${id ?? 'NEW_CARD'}/${localFile}`
    let rawCard = await this.realmManager.create(raw);
    let compiled = await this.searchIndex.indexCard(rawCard);
    return { data: rawCard.data, compiled };
  }

  async update(raw: RawCard): Promise<Card> {
    let originalRaw = await this.realmManager.read(raw);
    await this.realmManager.update(Object.assign({}, originalRaw, raw));
    let compiled = await this.builder.getCompiledCard(cardURL(raw));

    // TODO:
    // await updateIndexForThisCardAndEverybodyWhoDependsOnHim()

    return { data: raw.data, compiled };
  }

  async query(query: Query): Promise<Card[]> {
    let client = await this.db.getPool();
    try {
      let expression: CardExpression = ['select data from cards'];
      if (query.filter) {
        expression = [...expression, 'where', ...filterToExpression(query.filter, 'https://cardstack.com/base/base')];
      }
      let result = await client.query<{ data: any }>(expressionToSql(await this.prepareExpression(expression)));
      let deserializer = new RawCardDeserializer();
      return result.rows.map((row) => {
        let { raw, compiled } = deserializer.deserialize(row.data.data, row.data);
        if (!compiled) {
          throw new Error(`bug: database entry for ${cardURL(raw)} is missing the compiled card`);
        }
        return { data: raw.data, compiled };
      });
    } finally {
      client.release();
    }
  }

  private async prepareExpression(cardExpression: CardExpression): Promise<Expression> {
    let expression: Expression = [];
    for (let element of cardExpression) {
      if (isField(element)) {
        let segments = element.path.split('.');
        let { expression: inner, leaf } = resolveNestedPath(element.parentExpression, [element.on, ...segments]);

        let card: CompiledCard;
        try {
          card = (await this.load(element.on)).compiled;
        } catch (err) {
          if (err.status !== 404) {
            throw err;
          }
          throw new BadRequest(`Your filter refers to nonexistent card ${element.on}`);
        }
        while (segments.length) {
          let first = segments.shift()!;
          let field = card.fields[first];
          if (!field) {
            throw new BadRequest(`Your filter refers to nonexistent field "${first}" in card ${card.url}`);
          }
          card = field.card;
        }
        if (cardHasType(card, 'https://cardstack.com/base/integer')) {
          expression.push('cast(', ...inner, '->>', param(leaf), 'as bigint)');
        } else {
          expression.push(...inner, '->>', param(leaf));
        }
      } else {
        expression.push(element);
      }
    }
    return expression;
  }

  teardown() {}
}

function filterToExpression(filter: Filter, parentType: string): CardExpression {
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
    return every(
      Object.entries(filter.eq).map(([fieldPath, value]) => {
        return [field([columnName('searchData')], on, fieldPath), 'IS NOT DISTINCT FROM', param(value!)];
      })
    );
  }

  if ('range' in filter) {
    // NEXT steps: based on schema, we need to cast integer field like:
    //  select url, cast("searchData" #>> '{https://cardstack.local/post,views}' as bigint) > 7 from cards
    return every(
      Object.entries(filter.range).map(([fieldPath, predicates]) =>
        every(
          Object.entries(predicates).map(([operator, value]) => {
            return [field([columnName('searchData')], on, fieldPath), pgComparisons[operator], param(value!)];
          })
        )
      )
    );
  }

  throw unimpl('unknown');
}

const pgComparisons: { [operator: string]: string } = {
  gte: '>=',
  gt: '>',
  lt: '<',
  lte: '<=',
};

function unimpl(which: string) {
  return new Error(`unimpl ${which}`);
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-service': CardServiceFactory;
  }
}

function cardHasType(card: CompiledCard, url: string): boolean {
  if (card.url === url) {
    return true;
  } else if (!card.adoptsFrom) {
    return false;
  } else {
    return cardHasType(card.adoptsFrom, url);
  }
}
