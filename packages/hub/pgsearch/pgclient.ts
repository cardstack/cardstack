import { Pool, Client, QueryResult, PoolClient, Notification } from 'pg';
import migrate from 'node-pg-migrate';
import logger from '@cardstack/logger';
import postgresConfig from './postgres-config';
import { join } from 'path';
import * as JSON from 'json-typescript';
import {
  upsert,
  param,
  safeName,
  every,
  CardExpression,
  Expression,
  any,
  isParam,
  addExplicitParens,
  PgPrimitive,
  fieldQuery,
  fieldArity,
  fieldValue,
  FieldQuery,
  FieldValue,
  FieldArity,
} from './util';
import { AddressableCard, CardId, Card, FieldCard, cardstackFieldPattern } from '../card';
import CardstackError from '../error';
import { Query, baseType, Filter, EqFilter, RangeFilter } from '../query';
import { Sorts } from './sorts';
import snakeCase from 'lodash/snakeCase';
import flatten from 'lodash/flatten';
import assertNever from 'assert-never';
import { ScopedCardService } from '../cards-service';

const log = logger('cardstack/pgsearch');

function config() {
  return postgresConfig({
    database: `pgsearch_${process.env.PGSEARCH_NAMESPACE || 'dev'}`,
  });
}

export default class PgClient {
  private pool: Pool;

  constructor() {
    let c = config();
    this.pool = new Pool({
      user: c.user,
      host: c.host,
      database: c.database,
      password: c.password,
      port: c.port,
    });
  }

  async teardown() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  async ready() {
    await this.migrateDb();
  }

  private async migrateDb() {
    const config = postgresConfig();
    let client = new Client(Object.assign({}, config, { database: 'postgres' }));
    try {
      await client.connect();
      let response = await client.query(`select count(*)=1 as has_database from pg_database where datname=$1`, [
        config.database,
      ]);
      if (!response.rows[0].has_database) {
        await client.query(`create database ${safeName(config.database)}`);
      }
    } finally {
      client.end();
    }

    await migrate({
      direction: 'up',
      migrationsTable: 'migrations',
      singleTransaction: true,
      checkOrder: false,
      databaseUrl: {
        user: config.user,
        host: config.host,
        database: config.database,
        password: config.password,
        port: config.port,
      },
      count: Infinity,
      ignorePattern: '.*\\.(?!js)[^.]+',
      dir: join(__dirname, 'migrations'),
      log: (...args) => log.debug(...args),
    });
  }

  static async deleteSearchIndexIHopeYouKnowWhatYouAreDoing() {
    let c = config();
    let client = new Client(Object.assign({}, c, { database: 'postgres' }));
    try {
      await client.connect();
      await client.query(`drop database if exists ${safeName(c.database)}`);
    } finally {
      client.end();
    }
  }

  async queryCards(cards: ScopedCardService, query: CardExpression): Promise<QueryResult> {
    let client = await this.pool.connect();
    let sql = await this.cardQueryToSQL(cards, query);
    log.trace('search: %s trace: %j', sql.text, sql.values);
    try {
      return await client.query(sql);
    } finally {
      client.release();
    }
  }

  async query(query: Expression): Promise<QueryResult> {
    let client = await this.pool.connect();
    let sql = await this.expressionToSql(query);
    log.trace('search: %s trace: %j', sql.text, sql.values);
    try {
      return await client.query(sql);
    } finally {
      client.release();
    }
  }

  async withConnection<T>(
    fn: (connection: { client: PoolClient; query: (e: Expression) => Promise<QueryResult> }) => Promise<T>
  ): Promise<T> {
    let client = await this.pool.connect();
    let query = async (expression: Expression) => {
      let sql = this.expressionToSql(expression);
      log.trace('search: %s trace: %j', sql.text, sql.values);
      return await client.query(sql);
    };
    try {
      return await fn({ query, client });
    } finally {
      client.release();
    }
  }

  async listen(channel: string, handler: (notification: Notification) => void, fn: () => Promise<void>) {
    // I found that LISTEN/NOTIFY doesn't work reliably on connections from the
    // Pool, and this is substantiated by commentary on GitHub:
    //   https://github.com/brianc/node-postgres/issues/1543#issuecomment-353622236
    // So for listen purposes, we establish a completely separate connection.
    let c = config();
    let client = new Client({
      user: c.user,
      host: c.host,
      database: c.database,
      password: c.password,
      port: c.port,
    });
    await client.connect();
    try {
      client.on('notification', n => {
        log.trace(`heard pg notification for channel %s`, n.channel);
        handler(n);
      });
      await client.query(`LISTEN ${safeName(channel)}`);
      await fn();
    } finally {
      await client.end();
    }
  }

  private async cardQueryToSQL(cards: ScopedCardService, query: CardExpression) {
    return this.expressionToSql(await this.makeExpression(cards, query));
  }

  private async makeExpression(cards: ScopedCardService, query: CardExpression): Promise<Expression> {
    return flatten(
      await Promise.all(
        query.map(element => {
          if (isParam(element) || typeof element === 'string') {
            return Promise.resolve([element]);
          } else if (element.kind === 'field-query') {
            return this.handleFieldQuery(cards, element);
          } else if (element.kind === 'field-value') {
            return this.handleFieldValue(cards, element);
          } else if (element.kind === 'field-arity') {
            return this.handleFieldArity(cards, element);
          } else {
            throw assertNever(element);
          }
        })
      )
    );
  }

  private expressionToSql(query: Expression) {
    let values: PgPrimitive[] = [];
    let text = query
      .map(element => {
        if (isParam(element)) {
          values.push(element.param);
          return `$${values.length}`;
        } else if (typeof element === 'string') {
          return element;
        } else {
          assertNever(element);
        }
      })
      .join(' ');
    return {
      text,
      values,
    };
  }

  beginCardBatch(cards: ScopedCardService) {
    return new Batch(this, cards);
  }
  private async handleFieldQuery(cards: ScopedCardService, fieldQuery: FieldQuery): Promise<Expression> {
    let { path } = fieldQuery;
    if (path === 'csRealm' || path === 'csOriginalRealm' || path === 'csId') {
      return [snakeCase(path)];
    }

    return await this.walkFilterFieldPath(
      await cards.get(fieldQuery.typeContext),
      path,
      ['search_doc'],
      async (fieldCard, expression, fieldName) => {
        let buildQueryExpression = await fieldCard.loadFeature('field-buildQueryExpression');
        if (buildQueryExpression) {
          return buildQueryExpression(expression, fieldName);
        } else {
          return [...expression, '->>', param(fieldName)];
        }
      },
      async (expression, csField) => {
        return [...expression, '->>', param(csField)]; // this assumes arity of 1 for all the csFields which is probably not what we want long term...
      },
      {
        enter: async (fieldCard, expression, fieldName) => {
          if (fieldCard.csFieldArity === 'plural') {
            return ['jsonb_array_elements (', ...expression, '->', param(fieldName), ')'];
          } else {
            return [...expression, '->', param(fieldName)];
          }
        },
      }
    );
  }

  private async handleFieldValue(cards: ScopedCardService, fieldValue: FieldValue): Promise<Expression> {
    let { path, value } = fieldValue;
    let exp = await this.makeExpression(cards, value);

    return await this.walkFilterFieldPath(
      await cards.get(fieldValue.typeContext),
      path,
      exp,
      async (fieldCard, expression) => {
        let buildValueExpression = await fieldCard.loadFeature('field-buildValueExpression');
        if (buildValueExpression) {
          return buildValueExpression(expression);
        }
        return expression;
      },
      async expression => {
        return expression;
      }
    );
  }

  private async handleFieldArity(cards: ScopedCardService, fieldArity: FieldArity): Promise<Expression> {
    let { path, singular, plural } = fieldArity;

    let exp: CardExpression = await this.walkFilterFieldPath(
      await cards.get(fieldArity.typeContext),
      path,
      [],
      async (fieldCard, _expression: CardExpression, _fieldName) => {
        if (fieldCard.csFieldArity === 'plural') {
          return plural;
        }
        return singular;
      },
      async () => {
        return singular; // this assumes arity of 1 for all the csFields which is probably not what we want long term...
      },
      {
        exit: async (fieldCard, expression, _fieldName) => {
          if (fieldCard.csFieldArity === 'plural') {
            return ['array(select', ...expression, ') && array[true]'];
          } else {
            return expression;
          }
        },
      }
    );
    return await this.makeExpression(cards, exp);
  }

  private async walkFilterFieldPath(
    enclosingCard: Card,
    path: string,
    expression: Expression,
    handleLeafField: FilterFieldHandler<Expression>,
    handleCsField?: FilterCsFieldHandler<Expression>,
    handleInteriorField?: FilterFieldHandlerWithEntryAndExit<Expression>
  ): Promise<Expression>;
  private async walkFilterFieldPath(
    enclosingCard: Card,
    path: string,
    expression: CardExpression,
    handleLeafField: FilterFieldHandler<CardExpression>,
    handleCsField?: FilterCsFieldHandler<CardExpression>,
    handleInteriorField?: FilterFieldHandlerWithEntryAndExit<CardExpression>
  ): Promise<CardExpression>;
  private async walkFilterFieldPath(
    enclosingCard: Card,
    path: string,
    expression: Expression,
    handleLeafField: FilterFieldHandler<any[]>,
    handleCsField?: FilterCsFieldHandler<any[]>,
    handleInteriorField?: FilterFieldHandlerWithEntryAndExit<any[]>
  ): Promise<any> {
    let pathSegments = path.split('.');
    let isLeaf = pathSegments.length === 1;
    let currentSegment = pathSegments.shift() as string; // string.split() always has at least one item
    let isCsField = cardstackFieldPattern.test(currentSegment);
    if (isCsField && handleCsField) {
      expression = await handleCsField(expression, currentSegment);
    } else if (!isCsField) {
      let fieldCard = await enclosingCard.field(currentSegment);
      let fullFieldName = `${fieldCard.enclosingCard.canonicalURL}/${currentSegment}`;
      if (isLeaf) {
        expression = await handleLeafField(fieldCard, expression, fullFieldName);
      } else {
        let passThru: FilterFieldHandler<any[]> = async (_fc, e: Expression, _f) => e;
        // when dealing with an interior field that is not a leaf path segment,
        // the entrance and exit hooks allow you to decorate the expression for
        // the interior field before the interior's antecedant segment's
        // expression is processed and after the interior field's antecedant
        // segment's expression has been processed (i.e. recursing into the
        // antecedant field and recursing out of the antecedant field).
        let entranceHandler = handleInteriorField ? handleInteriorField.enter || passThru : passThru;
        let exitHandler = handleInteriorField ? handleInteriorField.exit || passThru : passThru;

        let interiorExpression = await this.walkFilterFieldPath(
          fieldCard,
          pathSegments.join('.'),
          await entranceHandler(fieldCard, expression, fullFieldName),
          handleLeafField,
          handleCsField,
          handleInteriorField
        );
        expression = await exitHandler(fieldCard, interiorExpression, fullFieldName);
      }
    }
    return expression;
  }

  async get(cards: ScopedCardService, id: CardId): Promise<AddressableCard> {
    let condition = every([
      [`cs_realm = `, param(id.csRealm)],
      [`cs_original_realm = `, param(id.csOriginalRealm ?? id.csRealm)],
      [`cs_id = `, param(id.csId)],
    ]);
    let result = await this.queryCards(cards, [`select pristine_doc from cards where`, ...condition]);
    if (result.rowCount !== 1) {
      throw new CardstackError(
        `Card not found with csRealm="${id.csRealm}", csOriginalRealm="${id.csOriginalRealm ?? id.csRealm}", csId="${
          id.csId
        }"`,
        { status: 404 }
      );
    }
    return cards.instantiate(result.rows[0].pristine_doc);
  }

  async search(
    cards: ScopedCardService,
    { filter, queryString, sort, page }: Query
  ): Promise<{ cards: AddressableCard[]; meta: ResponseMeta }> {
    let conditions = [] as CardExpression[];

    if (filter) {
      conditions.push(this.filterCondition(baseType(filter), filter));
    }

    if (queryString) {
      //conditions.push(this.queryCondition(queryString));
    }

    let totalResponsePromise = this.queryCards(cards, [`select count(*) from cards where`, ...every(conditions)]);

    let sorts = new Sorts(baseType(filter), sort);
    if (page && page.cursor) {
      conditions.push(sorts.afterExpression(page.cursor));
    }

    let query = [
      `select`,
      ...sorts.cursorColumns(),
      `, pristine_doc from cards where`,
      ...every(conditions),
      ...sorts.orderExpression(),
    ];

    let size = Number(page?.size ?? 10);
    query = [...query, 'limit', param(size + 1)];

    let response = await this.queryCards(cards, query);
    let totalResponse = await totalResponsePromise;
    return await this.assembleResponse(response, totalResponse, size, sorts, cards);
  }

  private async assembleResponse(
    response: QueryResult,
    totalResponse: QueryResult,
    requestedSize: number,
    sorts: Sorts,
    cardService: ScopedCardService
  ) {
    let page: ResponseMeta['page'] = {
      // nobody has more than 2^53-1 total docs right?
      total: parseInt(totalResponse.rows[0].count, 10),
    };
    let cards = response.rows;
    if (response.rowCount > requestedSize) {
      cards = cards.slice(0, requestedSize);
      let last = cards[cards.length - 1];
      page.cursor = sorts.getCursor(last);
    }

    return {
      cards: await Promise.all(cards.map(row => cardService.instantiate(row.pristine_doc))),
      meta: { page },
    };
  }

  private filterCondition(typeContext: CardId, filter: Filter): CardExpression {
    if (filter.type) {
      typeContext = filter.type;
    }

    if ('any' in filter) {
      return any(filter.any.map(item => this.filterCondition(typeContext, item)));
    } else if ('every' in filter) {
      return every(filter.every.map(item => this.filterCondition(typeContext, item)));
    } else if ('not' in filter) {
      return ['NOT', ...addExplicitParens(this.filterCondition(typeContext, filter.not))];
    } else if ('eq' in filter) {
      return this.eqCondition(typeContext, filter);
    } else if ('range' in filter) {
      return this.rangeCondition(typeContext, filter);
    } else {
      assertNever(filter);
    }
  }

  private eqCondition(typeContext: CardId, filter: EqFilter): CardExpression {
    return every(
      Object.entries(filter.eq).map(([key, value]) => {
        return this.fieldFilter(typeContext, key, value);
      })
    );
  }

  private fieldFilter(typeContext: CardId, key: string, value: JSON.Value): CardExpression {
    let query = fieldQuery(typeContext, key, 'filter');
    let v = fieldValue(typeContext, key, [param(value)], 'filter');
    return [fieldArity(typeContext, key, [query, '=', v], [query, '&&', 'array[', v, ']'], 'filter')];
  }

  private rangeCondition(typeContext: CardId, filter: RangeFilter): CardExpression {
    return every(
      flatten(
        Object.entries(filter.range).map(([path, range]) => {
          let query = fieldQuery(typeContext, path, 'filter');
          return Object.entries(range).map(([limit, value]) => {
            if (value == null) {
              return [];
            }
            let v = fieldValue(typeContext, path, [param(value)], 'filter');
            return [query, RANGE_OPERATORS[limit], v];
          });
        })
      )
    );
  }
}

export class Batch {
  private generations: {
    [realm: string]: number | undefined;
  } = {};

  constructor(private client: PgClient, private cards: ScopedCardService) {}

  async save(card: AddressableCard) {
    /* eslint-disable @typescript-eslint/camelcase */
    let row = {
      cs_realm: param(card.csRealm),
      cs_original_realm: param(card.csOriginalRealm),
      cs_id: param(card.csId),
      pristine_doc: param(((await card.asPristineDoc()).jsonapi as unknown) as JSON.Object),
      search_doc: param(((await card.asSearchDoc()) as unknown) as JSON.Object),
      generation: param(this.generations[card.csRealm] || null),
    };
    /* eslint-enable @typescript-eslint/camelcase */

    await this.client.queryCards(this.cards, upsert('cards', 'cards_pkey', row));
    log.debug('save realm: %s original realm: %s local id: %s', card.csRealm, card.csOriginalRealm, card.csId);
  }

  async delete(id: CardId) {
    await this.client.query([
      'delete from cards where ',
      ...every([
        ['cs_realm =', param(id.csRealm)],
        ['cs_original_realm = ', param(id.csOriginalRealm ?? id.csRealm)],
        ['cs_id = ', param(id.csId)],
      ]),
    ]);
    log.debug(
      'delete realm: %s original realm: %s local id: %s',
      id.csRealm,
      id.csOriginalRealm ?? id.csRealm,
      id.csId
    );
  }

  createGeneration(realm: string) {
    this.generations[realm] = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  async deleteOlderGenerations(realm: string) {
    if (this.generations[realm] == null) {
      throw new CardstackError(
        `tried to remove older generation of cards before new generation was created for realm '${realm}'`
      );
    }
    await this.client.query([
      'delete from cards where ',
      ...addExplicitParens(['generation !=', param(this.generations[realm]!), 'or generation is null']),
      ' and cs_realm =',
      param(realm),
    ]);
    log.debug(`deleted generations other than ${this.generations[realm]} for cards in realm '${realm}'`);
  }

  async done() {}
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    pgclient: PgClient;
  }
}

export interface ResponseMeta {
  page: { total: number; cursor?: string };
}

type FilterFieldHandler<T> = (fieldCard: FieldCard, expression: T, fieldName: string) => Promise<T>;

interface FilterFieldHandlerWithEntryAndExit<T> {
  enter?: FilterFieldHandler<T>;
  exit?: FilterFieldHandler<T>;
}

type FilterCsFieldHandler<T> = (expression: T, csFieldName: string) => Promise<T>;

const RANGE_OPERATORS: { [limit: string]: string } = Object.freeze({
  lte: '<=',
  gte: '>=',
  lt: '<',
  gt: '>',
});
