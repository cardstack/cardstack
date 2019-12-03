import {
  Pool,
  Client,
  QueryArrayConfig,
  QueryArrayResult,
  QueryResultRow,
  QueryConfig,
  QueryResult
} from "pg";
import migrate from "node-pg-migrate";
import logger from "@cardstack/logger";
import postgresConfig from "./postgres-config";
import { join } from "path";
import * as JSON from "json-typescript";
import { upsert, queryToSQL, param, safeName, every, Expression } from "./util";
import { CardWithId, CardId } from "../card";
import { Session } from "../session";
import CardstackError from "../error";
import { Query } from "../query";
import { Sorts } from "./sorts";

const log = logger("cardstack/pgsearch");

function config() {
  return postgresConfig({
    database: `pgsearch_${process.env.PGSEARCH_NAMESPACE || "dev"}`
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
      port: c.port
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
    let client = new Client(
      Object.assign({}, config, { database: "postgres" })
    );
    try {
      await client.connect();
      let response = await client.query(
        `select count(*)=1 as has_database from pg_database where datname=$1`,
        [config.database]
      );
      if (!response.rows[0].has_database) {
        await client.query(`create database ${safeName(config.database)}`);
      }
    } finally {
      client.end();
    }

    await migrate({
      direction: "up",
      migrationsTable: "migrations",
      singleTransaction: true,
      checkOrder: false,
      databaseUrl: {
        user: config.user,
        host: config.host,
        database: config.database,
        password: config.password,
        port: config.port
      },
      count: Infinity,
      ignorePattern: ".*\\.(?!js)[^.]+",
      dir: join(__dirname, "migrations"),
      log: (...args) => log.debug(...args)
    });
  }

  static async deleteSearchIndexIHopeYouKnowWhatYouAreDoing() {
    let c = config();
    let client = new Client(Object.assign({}, c, { database: "postgres" }));
    try {
      await client.connect();
      await client.query(`drop database if exists ${safeName(c.database)}`);
    } finally {
      client.end();
    }
  }

  query<R extends any[] = any[], I extends any[] = any[]>(
    queryConfig: QueryArrayConfig<I>,
    values?: I
  ): Promise<QueryArrayResult<R>>;
  query<R extends QueryResultRow = any, I extends any[] = any[]>(
    queryConfig: QueryConfig<I>
  ): Promise<QueryResult<R>>;
  query<R extends QueryResultRow = any, I extends any[] = any[]>(
    queryTextOrConfig: string | QueryConfig<I>,
    values?: I
  ): Promise<QueryResult<R>>;
  async query(arg: any, ...rest: any[]) {
    let client = await this.pool.connect();
    try {
      return await client.query(arg, ...rest);
    } finally {
      client.release();
    }
  }

  beginBatch() {
    return new Batch(this);
  }

  async get(_session: Session, id: CardId): Promise<CardWithId> {
    let condition = every([
      [`realm = `, param(id.realm.href)],
      [`original_realm = `, param(id.originalRealm?.href ?? id.realm.href)],
      [`local_id = `, param(id.localId)]
    ]);
    let result = await this.query(queryToSQL([`select pristine_doc from cards where`, ...condition]));
    if (result.rowCount !== 1) {
      throw new CardstackError(`Card not found with realm="${id.realm.href}", original-realm="${id.originalRealm?.href ?? id.realm.href}", local-id="${id.localId}"`, { status: 404 });
    }
    return new CardWithId(result.rows[0].pristine_doc);
  }

  async search(_session: Session, { filter, queryString, sort, page }: Query): Promise<{ cards: CardWithId[] }> {
    let conditions = [] as Expression[];

    if (filter) {
      conditions.push(this.filterCondition(filter));
    }

    if (queryString) {
      conditions.push(this.queryCondition(queryString));
    }

    let totalResponsePromise = this.query(queryToSQL([`select count(*) from cards where`, ...every(conditions)]));

    let sorts = new Sorts(this, sort);
    if (page && page.cursor) {
      conditions.push(sorts.afterExpression(page.cursor));
    }

    let query = [`select`, ...sorts.cursorColumns() ,`, pristine_doc from documents where`, ...every(conditions), ...sorts.orderExpression()];

    let size = page?.size ?? 10;
    query = [...query, "limit", param(size + 1) ];

    let sql = queryToSQL(query);
    log.trace("search: %s trace: %j", sql.text, sql.values);
    let response = await this.query(sql);
    let totalResponse = await totalResponsePromise;

  }
}

class Batch {
  constructor(private client: PgClient) {}

  async save(card: CardWithId) {
    /* eslint-disable @typescript-eslint/camelcase */
    let row = {
      realm: param(card.realm.href),
      original_realm: param(card.originalRealm.href),
      local_id: param(card.localId),
      pristine_doc: param(
        ((await card.asPristineDoc()).jsonapi as unknown) as JSON.Object
      )
    };
    /* eslint-enable @typescript-eslint/camelcase */

    await this.client.query(queryToSQL(upsert("cards", "cards_pkey", row)));
    log.debug(
      "save realm: %s original realm: %s local id: %s",
      card.realm,
      card.originalRealm,
      card.localId
    );
  }

  async done() {}
}

declare module "@cardstack/hub/dependency-injection" {
  interface KnownServices {
    pgclient: PgClient;
  }
}
