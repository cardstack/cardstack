import config from 'config';
import { Client } from 'pg';

export default class DatabaseManager {
  private client: Client | undefined;

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

  async teardown() {
    if (this.dbConfig.useTransactionalRollbacks) {
      await this.client?.query('ROLLBACK');
    }
    await this.client?.end();
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'database-manager': DatabaseManager;
  }
}
