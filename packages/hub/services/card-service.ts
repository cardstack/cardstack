import { Card, CompiledCard, Unsaved, RawCard, CardContent, Format } from '@cardstack/core/src/interfaces';
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
import logger from '@cardstack/logger';
import { merge } from 'lodash';
import { CardEnv } from '@cardstack/core/src/interfaces';
import CardModel from '@cardstack/core/src/card-model';

// This is a placeholder because we haven't built out different per-user
// authorization contexts.
export const INSECURE_CONTEXT = {};

const log = logger('hub/card-service');

export default class CardServiceFactory {
  private realmManager = inject('realm-manager', { as: 'realmManager' });
  private builder = inject('card-builder', { as: 'builder' });
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
    let deserializer = new RawCardDeserializer();
    let result = await this.loadCardFromDB('SELECT compiled, "compileErrors", deps from cards where url = $1', cardURL);
    let { raw, compiled } = deserializer.deserialize(result.compiled.data, result.compiled);
    if (!compiled) {
      throw new CardstackError(`bug: db entry for ${cardURL} is missing the compiled card`);
    }
    return {
      compiled,
      raw,
    };
  }

  async loadData(cardURL: string, format: Format): Promise<CardModel> {
    log.trace('load', cardURL);

    let result = await this.loadCardFromDB(
      'SELECT url, data, "schemaModule", "componentInfos" , "compileErrors", deps from cards where url = $1',
      cardURL
    );
    return CardModel.fromDatabase(this.cardEnv(), format, result);
  }

  private async loadCardFromDB(query: string, cardURL: string): Promise<Record<string, any>> {
    let db = await this.db.getPool();
    try {
      let {
        rows: [result],
      } = await db.query(query, [cardURL]);
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
      return result;
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

  async createData(
    rawData: Pick<RawCard<Unsaved>, 'id' | 'realm' | 'adoptsFrom' | 'data'>,
    format: Format
  ): Promise<CardContent> {
    let { raw, compiled } = await this.create(rawData);
    return this.contentFromCompiled(raw, compiled, format);
  }

  async updateData(
    partialRawData: Pick<RawCard, 'id' | 'realm' | 'adoptsFrom' | 'data'>,
    format: Format
  ): Promise<CardContent> {
    let { raw, compiled } = await this.update(partialRawData);
    return this.contentFromCompiled(raw, compiled, format);
  }

  async query(format: Format, query: Query): Promise<CardModel[]> {
    let client = await this.db.getPool();
    try {
      let expression: CardExpression = ['select url, data, "schemaModule", "componentInfos" from cards'];
      if (query.filter) {
        expression = [...expression, 'where', ...filterToExpression(query.filter, 'https://cardstack.com/base/base')];
      }
      let result = await client.query<{ compiled: any }>(expressionToSql(await this.prepareExpression(expression)));
      return result.rows.map((row) => {
        return CardModel.fromDatabase(this.cardEnv(), format, row);
      });
    } finally {
      client.release();
    }
  }

  private cardEnv(): CardEnv {
    return {
      load: this.loadData.bind(this),
      send() {
        throw new Error('TODO: We should be using cardEnv.send in this environment');
      },
      prepareComponent() {
        // Intentionally a noop for now
      },
      tracked(_target: CardModel, _prop: string, _desc: PropertyDescriptor) {
        // Intentionally a noop for now
      },
    };
  }

  /**
   * @deprecated Functions needing this method should be updated to use more
   * optimized queries. Look at the loadData function for how
   */
  private contentFromCompiled(raw: RawCard, compiled: CompiledCard, format: Format): CardContent {
    return {
      data: raw.data ?? {},
      schemaModule: compiled.schemaModule.global,
      usedFields: compiled[format].usedFields,
      componentModule: compiled[format].moduleName.global,
      url: compiled.url,
      format,
    };
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
