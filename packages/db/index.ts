import config from 'config';
import { Client, Pool, PoolClient } from 'pg';
import { URL } from 'url';

export default class DatabaseManager {
  private client: Client | undefined;
  private pool: Pool | undefined;

  dbConfig: Record<string, any> = config.get('db');

  async getClient() {
    if (!this.client) {
      this.client = new Client(this.dbConfig.url as string);
      await this.client.connect();
      if (this.dbConfig.useTransactionalRollbacks) {
        await this.client.query('START TRANSACTION');
      }
    }
    return this.client;
  }

  async getPool(): Promise<PoolClient> {
    if (!this.pool) {
      let u = new URL(this.dbConfig.url);
      this.pool = new Pool({
        user: u.username,
        host: u.hostname,
        database: u.pathname.substr(1),
        password: u.password,
        port: parseInt(u.port),
      });
    }

    return await this.pool.connect();
  }

  async performTransaction(db: Client, cb: any) {
    let isTestEnv = process.env.NODE_ENV === 'test';

    if (isTestEnv) {
      await cb(); // Don't commit any data to the test db
    } else {
      try {
        await db.query('BEGIN');
        await cb();
        await db.query('COMMIT');
      } catch (e) {
        await db.query('ROLLBACK');
        throw e;
      }
    }
  }

  async teardown() {
    if (this.dbConfig.useTransactionalRollbacks) {
      await this.client?.query('ROLLBACK');
    }
    if (this.pool) {
      await this.pool.end();
    }
    await this.client?.end();
  }
}

import '@cardstack/di';
declare module '@cardstack/di' {
  interface KnownServices {
    'database-manager': DatabaseManager;
  }
}
