import {
  Message as DiscordMessage,
  Guild as DiscordGuild,
  GuildMember as DiscordGuildMember,
  Collection,
} from 'discord.js';
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

export type Message = DiscordMessage | MockMessage;
export type GuildMember = DiscordGuildMember | MockGuildMember;
export type Guild = DiscordGuild | MockGuild;

export interface MockMessage {
  content: string;
  author: MockUser;
  member?: MockGuildMember;
  channel: MockChannel;
  guild?: MockGuild;
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

export interface MockChannel {
  type: string;
  id: string;
  send: (msg: string) => Promise<unknown>;
}
