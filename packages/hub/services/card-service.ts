import { Card, CompiledCard, Unsaved, RawCard } from '@cardstack/core/src/interfaces';
import { RawCardDeserializer } from '@cardstack/core/src/serializers';
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
import { BadRequest, CardstackError, NotFound } from '@cardstack/core/src/utils/errors';
import { cardURL } from '@cardstack/core/src/utils';
import logger from '@cardstack/logger';
import { merge } from 'lodash';
import { service } from '@cardstack/hub/services';

// This is a placeholder because we haven't built out different per-user
// authorization contexts.
export const INSECURE_CONTEXT = {};

const log = logger('hub/card-service');

export default class CardServiceFactory {
  private realmManager = service('realm-manager', { as: 'realmManager' });
  private builder = service('card-builder', { as: 'builder' });
  private searchIndex = inject('searchIndex');
  private db = inject('database-manager', { as: 'db' });

  as(requestContext: unknown): CardService {
    return new CardService(requestContext, this.realmManager, this.builder, this.searchIndex, this.db);
  }
}

export class CardService {
  constructor(
    _requestContext: unknown,
    private realmManager: CardServiceFactory['realmManager'],
    private builder: CardServiceFactory['builder'],
    private searchIndex: CardServiceFactory['searchIndex'],
    private db: CardServiceFactory['db']
  ) {}

  async load(cardURL: string): Promise<Card> {
    log.trace('load', cardURL);
    let db = await this.db.getPool();
    let deserializer = new RawCardDeserializer();
    try {
      let {
        rows: [result],
      } = await db.query('SELECT compiled, "compileErrors", deps from cards where url = $1', [cardURL]);
      if (!result) {
        throw new NotFound(`Card ${cardURL} was not found`);
      }
      if (result.compileErrors) {
        let err = CardstackError.fromSerializableError(result.compileErrors);
        if (result.deps) {
          err.deps = result.deps;
        }
        throw err;
      }
      let { raw, compiled } = deserializer.deserialize(result.compiled.data, result.compiled);
      if (!compiled) {
        throw new CardstackError(`bug: db entry for ${cardURL} is missing the compiled card`);
      }
      return {
        compiled,
        raw,
      };
    } finally {
      db.release();
    }
  }

  async create(raw: RawCard<Unsaved>): Promise<Card> {
    let compiler = this.builder.compileCardFromRaw(raw);
    let compiledCard = await compiler.compile();
    let rawCard = await this.realmManager.create(raw);
    let compiled = await this.searchIndex.indexCard(rawCard, compiledCard, compiler);
    return { raw: rawCard, compiled };
  }

  async update(partialRaw: RawCard): Promise<Card> {
    let raw = merge({}, await this.realmManager.read(partialRaw), partialRaw);
    let compiler = this.builder.compileCardFromRaw(raw);
    let compiledCard = await compiler.compile();
    await this.realmManager.update(raw);
    let compiled = await this.searchIndex.indexCard(raw, compiledCard, compiler);
    return { raw, compiled };
  }

  async delete(raw: RawCard): Promise<void> {
    await this.realmManager.delete(raw);
    await this.searchIndex.deleteCard(raw);
  }

  async query(query: Query): Promise<Card[]> {
    let client = await this.db.getPool();
    try {
      let expression: CardExpression = ['select compiled from cards'];
      if (query.filter) {
        expression = [...expression, 'where', ...filterToExpression(query.filter, 'https://cardstack.com/base/base')];
      }
      let result = await client.query<{ compiled: any }>(expressionToSql(await this.prepareExpression(expression)));
      let deserializer = new RawCardDeserializer();
      return result.rows.map((row) => {
        let { raw, compiled } = deserializer.deserialize(row.compiled.data, row.compiled);
        if (!compiled) {
          throw new Error(`bug: database entry for ${cardURL(raw)} is missing the compiled card`);
        }
        return { raw, compiled };
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
        } catch (err: any) {
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

declare module '@cardstack/hub/services' {
  interface HubServices {
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
