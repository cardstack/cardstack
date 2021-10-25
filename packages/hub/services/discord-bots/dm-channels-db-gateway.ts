import { inject } from '@cardstack/di';
import { DmChannelsDbGateway } from '@cardstack/discord-bot/types';
import { Client } from 'pg';

export default class HubDmChannelsDbGateway implements DmChannelsDbGateway {
  databaseManager = inject('database-manager', { as: 'databaseManager' });

  private client?: Client;

  async getDatabaseClient(): Promise<Client> {
    if (!this.client) {
      this.client = await this.databaseManager.getClient();
    }
    return this.client;
  }

  async activateDMConversation(channelId: string, userId: string, command: string): Promise<void> {
    return await this.updateDMConversationActivity(channelId, userId, command);
  }

  async continueDMConversation(channelId: string, userId: string, command: string): Promise<void> {
    return await this.updateDMConversationActivity(channelId, userId, command);
  }

  async deactivateDMConversation(channelId: string, userId: string): Promise<void> {
    return await this.updateDMConversationActivity(channelId, userId, null);
  }

  async updateDMConversationActivity(channelId: string, userId: string, command: string | null): Promise<void> {
    let client = await this.getDatabaseClient();
    await client.query(
      `INSERT INTO dm_channels (
             channel_id, user_id, command
           ) VALUES ($1, $2, $3)
           ON CONFLICT (channel_id)
           DO UPDATE SET
             command = $3,
             updated_at = now()`,
      [channelId, userId, command]
    );
  }

  async conversationCommand(channelId: string): Promise<string | undefined> {
    let client = await this.getDatabaseClient();
    let { rows } = await client.query(`SELECT command from dm_channels where channel_id = $1`, [channelId]);
    if (rows.length === 0) {
      return;
    }

    let [{ command }] = rows;
    return command;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'hub-dm-channels-db-gateway': HubDmChannelsDbGateway;
  }
}
