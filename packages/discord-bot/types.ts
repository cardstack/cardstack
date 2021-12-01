import {
  Message as DiscordMessage,
  Guild as DiscordGuild,
  GuildMember as DiscordGuildMember,
  Collection,
  Snowflake,
} from 'discord.js';
import { Client as PgClient } from 'pg';

export interface DiscordBotConfig {
  botId: string;
  botToken: string;
  cordeBotId: string;
  cordeBotToken: string;
  commandPrefix: string;
  allowedGuilds: string;
  allowedChannels: string;
  messageVerificationDelayMs: number;
}
import { MockChannel } from './utils/mocks';
import { SUUID } from 'short-uuid';
export { SUUID } from 'short-uuid';
export { MockChannel, Snowflake };

export type Message = DiscordMessage | MockMessage;
export type GuildMember = DiscordGuildMember | MockGuildMember;
export type Guild = DiscordGuild | MockGuild;

export interface MockMessage {
  id: string;
  content: string;
  author: MockUser;
  member?: MockGuildMember;
  channel: MockChannel;
  guild?: MockGuild;
  // I'm being really loose with what a message item is, if we want to nail it
  // down there is a large pile of stuff this could be, but I didn't want to
  // make the mock too heavyweight
  reply: (msg: any) => Promise<unknown>;
}
export interface MockUser {
  id: string;
  bot: boolean;
  username: string;
}

export interface MockGuild {
  id: string;
  roles: {
    cache: Collection<string, MockRole>;
  };
}

export interface MockRole {
  id: string;
  name: string;
}

export interface MockGuildMember {
  id: string;
  user: MockUser;
  createDM: () => Promise<MockChannel>;
  roles: {
    cache: Collection<string, MockRole>;
  };
}

export type NotificationCallback = (msg: any) => void;

export interface DiscordBotsDbGateway {
  getDatabaseClient(): Promise<PgClient>;
  getCurrentListenerId(type: string): Promise<SUUID | null>;
  getLastMessageIdProcessed(type: string): Promise<Snowflake | null>;
  becomeListener(botInstanceId: SUUID, type: string, previousListenerId?: SUUID | null): Promise<boolean>;
  updateStatus(status: DiscordBotStatus, botType: string, botInstanceId: SUUID): Promise<void>;
  updateLastMessageProcessed(messageId: Snowflake, botInstanceId: SUUID): Promise<void>;
  subscribe(channel: string, botType: string, callback: NotificationCallback): Promise<void>;
  unsubscribe(channel: string, botType: string): Promise<void>;
}

export interface DmChannelsDbGateway {
  conversationCommand(channelId: string): Promise<string | undefined>;
  activateDMConversation(channelId: string, userId: string, commandName: string): Promise<void>;
  deactivateDMConversation(channelId: string, userId: string): Promise<void>;
}

export type DiscordBotStatus = 'connecting' | 'connected' | 'listening' | 'disconnected' | 'unresponsive';

export interface MessageVerificationScheduler {
  destroy(): void;
  cancelScheduledVerification(messageId: Snowflake): Message | undefined;
  scheduledVerificationsCount: number;
  scheduleVerification(message: Message): Promise<void>;
}
