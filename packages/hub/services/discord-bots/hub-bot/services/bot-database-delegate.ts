import { inject } from '@cardstack/di';
import { BotDatabaseDelegate } from '@cardstack/discord-bot/types';
import { Client } from 'pg';

export class BotDatabaseDelegateImpl implements BotDatabaseDelegate {
  databaseManager = inject('database-manager', { as: 'databaseManager' });

  getDatabaseClient(): Promise<Client> {
    return this.databaseManager.getClient();
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'bot-database-delegate': BotDatabaseDelegate;
  }
}
