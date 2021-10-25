import { inject } from '@cardstack/di';
import { DiscordBotsDbGateway, DiscordBotStatus, NotificationCallback, Snowflake } from '@cardstack/discord-bot/types';
import { Client, Notification } from 'pg';
import logger from '@cardstack/logger';
import { SUUID } from 'short-uuid';

const log = logger('bot:hub-discord-bots-db-gateway');

export default class HubDiscordBotsDbGateway implements DiscordBotsDbGateway {
  databaseManager = inject('database-manager', { as: 'databaseManager' });

  private client?: Client;
  private listeningChannels: Map<string, NotificationCallback> = new Map();
  private handleNotification!: (...args: any) => void;

  async getDatabaseClient(): Promise<Client> {
    if (!this.client) {
      this.client = await this.databaseManager.getClient();
      this.handleNotification = (message: Notification) => {
        let { channel, payload } = message;
        let callbacks = Array.from(this.listeningChannels.keys())
          .filter((key) => key.startsWith(`${channel}:`))
          .map((key) => this.listeningChannels.get(key));
        if (callbacks.length > 0) {
          let jsonPayload = payload ? JSON.parse(payload) : {};
          callbacks.forEach((callback) => {
            callback?.(jsonPayload);
          });
        }
      };
      this.client.on('notification', this.handleNotification);
    }
    return this.client;
  }

  async teardown() {
    this.client?.off('notification', this.handleNotification);
  }

  async updateStatus(status: DiscordBotStatus, botType: string, botInstanceId: SUUID): Promise<void> {
    let client = await this.getDatabaseClient();
    await client.query(
      'INSERT INTO discord_bots(bot_id, bot_type, status) VALUES ($1, $2, $3) ON CONFLICT(bot_id) DO UPDATE SET status = $3',
      [botInstanceId, botType, status]
    );
  }

  async getCurrentListenerId(botType: string): Promise<SUUID | null> {
    let client = await this.getDatabaseClient();
    let { rows } = await client.query('SELECT bot_id FROM discord_bots WHERE bot_type = $1 AND status = $2', [
      botType,
      'listening',
    ]);
    return rows[0]?.bot_id;
  }

  async becomeListener(botInstanceId: SUUID, botType: string, previousListenerId?: SUUID | null): Promise<boolean> {
    if (previousListenerId) {
      return await this.becomeListenerReplacingPreviousListener(botInstanceId, previousListenerId);
    } else {
      return await this.becomeListenerIfNoListenerForThisBotType(botInstanceId, botType);
    }
  }

  private async becomeListenerIfNoListenerForThisBotType(botInstanceId: SUUID, botType: string): Promise<boolean> {
    let client = await this.getDatabaseClient();
    let result = await client.query(
      'UPDATE discord_bots SET status = $1 WHERE bot_id = $2 AND NOT EXISTS (SELECT * FROM discord_bots WHERE bot_type = $3 AND status = $4)',
      ['listening', botInstanceId, botType, 'listening']
    );
    return result.rowCount > 0;
  }

  private async becomeListenerReplacingPreviousListener(
    botInstanceId: SUUID,
    previousListenerId: SUUID
  ): Promise<boolean> {
    let client = await this.getDatabaseClient();
    let oldListenerResult = await client.query(
      'UPDATE discord_bots SET status = $1 WHERE bot_id = $2 and status = $3',
      ['disconnected', previousListenerId, 'listening']
    );
    if (oldListenerResult.rowCount === 0) {
      return false;
    }
    let newListenerResult = await client.query('UPDATE discord_bots SET status = $1 WHERE bot_id = $2', [
      'listening',
      botInstanceId,
    ]);
    if (newListenerResult.rowCount === 0) {
      throw new Error('Expected to successfully set bot to listening status, but failed');
    } else {
      await client.query('UPDATE discord_bots SET status = $1 WHERE bot_id = $2', ['disconnected', previousListenerId]);
    }
    return true;
  }

  async updateLastMessageProcessed(messageId: string, botInstanceId: SUUID): Promise<void> {
    let client = await this.getDatabaseClient();
    try {
      await client.query('UPDATE discord_bots SET last_message_id = $1 WHERE bot_id = $2', [messageId, botInstanceId]);
    } catch (e: any) {
      // don't fail the transaction if we can't update the last message id
      log.error(`Error updating last message processed for bot ${botInstanceId}: ${e.message}`);
    }
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

  async subscribe(channel: string, botType: string, callback: NotificationCallback): Promise<void> {
    let keys = Array.from(this.listeningChannels.keys());
    if (!keys.find((key) => key.startsWith(`${channel}:`))) {
      let client = await this.getDatabaseClient();
      await client.query(`LISTEN ${channel}`);
    }
    this.listeningChannels.set(`${channel}:${botType}`, (payload: any) => {
      if (payload.bot_type === botType) {
        callback(payload);
      }
    });
  }

  async unsubscribe(channel: string, botType: string): Promise<void> {
    this.listeningChannels.delete(`${channel}:${botType}`);
    let keys = Array.from(this.listeningChannels.keys());
    if (!keys.find((key) => key.startsWith(`${channel}:`))) {
      let client = await this.getDatabaseClient();
      await client.query(`UNLISTEN ${channel}`);
    }
  }

  async getLastMessageIdProcessed(type: string): Promise<Snowflake | null> {
    let client = await this.getDatabaseClient();
    let { rows } = await client.query(`SELECT last_message_id FROM discord_bots WHERE bot_type = $1 and status = $2`, [
      type,
      'listening',
    ]);
    if (rows.length === 0) {
      return null;
    }
    return rows[0].last_message_id;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'hub-discord-bots-db-gateway': HubDiscordBotsDbGateway;
  }
}
