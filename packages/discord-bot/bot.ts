import { Client, MessageEmbed } from 'discord.js';
import {
  DiscordBotsDbGateway,
  DiscordBotConfig,
  DiscordBotStatus,
  MessageVerificationScheduler,
  DmChannelsDbGateway,
} from './types';
import tmp from 'tmp';
import QRCode from 'qrcode';
import { basename } from 'path';
import { Message, Snowflake } from './types';
import logger from '@cardstack/logger';

const log = logger('bot:main');

export interface CommandCallback {
  (client: Bot, message: Message, args?: string[]): Promise<void>;
}
import shortUuid, { SUUID } from 'short-uuid';
import InMemoryMessageVerificationScheduler from './in-memory-message-verification-scheduler';

export interface EventCallback {
  (client: Bot, message?: Message, args?: string[]): Promise<void>;
}

export interface Event {
  name: string;
  run: EventCallback;
}

export interface CommandCallback {
  (client: Bot, message: Message, args?: string[]): Promise<void>;
}

export interface Command {
  name: string;
  run: CommandCallback;
  aliases: string[];
  description: string;
}

export class Bot extends Client {
  config!: DiscordBotConfig;
  type = 'generic'; // override this in your bot subclass
  discordBotsDbGateway!: DiscordBotsDbGateway;
  dmChannelsDbGateway!: DmChannelsDbGateway;
  guildCommands = new Map<string, Command>();
  dmCommands = new Map<string, Command>();
  isConfigured = false;
  status: DiscordBotStatus = 'disconnected';
  botInstanceId: SUUID = shortUuid().generate();
  messageProcessingVerifier!: MessageVerificationScheduler;

  async start(): Promise<void> {
    log.info(`booting pid:${process.pid}`);

    if (!this.config) {
      throw new Error('config property must be set before starting the bot');
    }
    if (!this.discordBotsDbGateway) {
      throw new Error('discordBotsDbGateway property must be set before starting the bot');
    }
    this.messageProcessingVerifier = new InMemoryMessageVerificationScheduler(this);
    if (this.guildCommands.size === 0 && this.dmCommands.size === 0) {
      throw new Error('No bot commands found. Your subclass should provide some.');
    }
    await this.updateStatus('connecting');

    if (!this.config.botToken) {
      log.info('No bot token found. Bot will not login to discord.');
      return;
    }
    if (process.env.NODE_ENV !== 'test') {
      await this.login(this.config.botToken);
    }
    await this.listenForDatabaseNotifications();
    await this.updateStatus('connected');
    await this.wireDiscordEventHandling();
    await this.attemptToBecomeListener();

    log.info(`started (${this.type}:${this.botInstanceId})`);
  }

  async updateStatus(status: DiscordBotStatus): Promise<void> {
    await this.discordBotsDbGateway?.updateStatus(status, this.type, this.botInstanceId);
    log.info(`status: ${status}`);
    this.status = status;
  }

  private async attemptToBecomeListener(listenerId?: SUUID | null) {
    if (await this.discordBotsDbGateway.becomeListener(this.botInstanceId, this.type, listenerId)) {
      this.status = 'listening';
      log.info(`status: listening`);
      return true;
    }
    return false;
  }

  private async listenForDatabaseNotifications() {
    await this.discordBotsDbGateway.subscribe('discord_bot_status', this.type, this.handleBotStatusUpdate.bind(this));
    await this.discordBotsDbGateway.subscribe(
      'discord_bot_message_processing',
      this.type,
      this.handleBotMessageProcessing.bind(this)
    );
  }

  async notifyMessageProcessed(message: Message): Promise<void> {
    await this.discordBotsDbGateway.updateLastMessageProcessed(message.id, this.botInstanceId);
  }

  async handleBotStatusUpdate(_payload: any) {
    if (this.status !== 'connected') {
      return;
    }
    await this.attemptToBecomeListener();
  }

  handleBotMessageProcessing(payload: any) {
    this.messageProcessingVerifier.cancelScheduledVerification(payload.id);
  }

  private async wireDiscordEventHandling() {
    let handlers = await Promise.all([
      import('./events/direct-message'),
      import('./events/guild-message'),
      import('./events/ready'),
    ]);
    for (let handler of handlers) {
      const { name, run } = handler as Event;
      this.on(name, run.bind(undefined, this));
    }
  }
  /* This method is called after a delay to verify that a message has processed by the listening bot.
   * If it has, all is well. If it hasn't, this instance will try to assume listening status and
   * process the message.
   */
  async verifyMessage(messageId: string, listenerId: shortUuid.SUUID | null) {
    let message = this.messageProcessingVerifier.cancelScheduledVerification(messageId);
    if (!message) return;
    let lastProcessedMessageId = await this.discordBotsDbGateway.getLastMessageIdProcessed(this.type);
    if (lastProcessedMessageId && messageIdLte(messageId, lastProcessedMessageId)) {
      return;
    }
    let isListener = this.status === 'listening';
    if (!isListener) {
      isListener = await this.attemptToBecomeListener(listenerId);
    }
    if (isListener) {
      // process the message
      this.emit('message', message as any);
    } else {
      // schedule another check
      this.messageProcessingVerifier.scheduleVerification(message);
    }
  }

  async disconnect(): Promise<void> {
    await this.updateStatus('disconnected');
    this.destroy();
  }

  destroy() {
    if (this.status !== 'disconnected') {
      this.updateStatus('disconnected');
    }
    let { discordBotsDbGateway } = this;
    if (discordBotsDbGateway) {
      discordBotsDbGateway.unsubscribe('discord_bot_status', this.type);
      discordBotsDbGateway.unsubscribe('discord_bot_message_processing', this.type);
    }
    this.messageProcessingVerifier?.destroy();
    super.destroy();
  }

  getDatabaseClient() {
    return this.discordBotsDbGateway.getDatabaseClient();
  }
}

export async function buildMessageWithQRCode(uri: string): Promise<MessageEmbed> {
  let qrCodeFile = tmp.tmpNameSync({ postfix: '.png' });
  return new Promise(function (resolve, reject) {
    QRCode.toFile(qrCodeFile, uri, (err) => {
      if (err) {
        reject(err);
        return;
      }

      let embed = new MessageEmbed().attachFiles([qrCodeFile]).setImage(`attachment://${basename(qrCodeFile)}`);
      resolve(embed);
    });
  });
}

function messageIdLte(messageId: Snowflake, referenceMessageId: Snowflake): boolean {
  return BigInt(messageId) <= BigInt(referenceMessageId);
}
