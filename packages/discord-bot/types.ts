import {
  Message as DiscordMessage,
  Guild as DiscordGuild,
  GuildMember as DiscordGuildMember,
  Collection,
} from 'discord.js';
import { Client as PgClient } from 'pg';
export interface DiscordBotConfig {
  botId: string;
  botToken: string;
  cordeBotId: string;
  cordeBotToken: string;
  commandPrefix: string;
  commandsDir: string;
  allowedGuilds: string;
  allowedChannels: string;
}
import { MockChannel } from './utils/mocks';
export { MockChannel };

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
export interface BotDatabaseDelegate {
  getDatabaseClient(): Promise<PgClient>;
}
