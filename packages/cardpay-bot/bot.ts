import { Client, Message } from 'discord.js';
import glob from 'glob-promise';
import config from 'config';
import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';

export interface CommandCallback {
  (client: Bot, message: Message, args?: string[]): Promise<void>;
}
export interface EventCallback {
  (client: Bot, message?: Message, args?: string[]): Promise<void>;
}
export interface Command {
  name: string;
  run: CommandCallback;
  aliases: string[];
  description: string;
}
export interface Event {
  name: string;
  run: EventCallback;
}
interface DiscordConfig {
  botToken: string;
}

const { botToken } = config.get('discord') as DiscordConfig;

export class Bot extends Client {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });
  guildCommands = new Map<string, Command>();
  dmCommands = new Map<string, Command>();

  async start(): Promise<void> {
    const guildCommandModules: string[] = await glob(`${__dirname}/guild-commands/**/*.js`);
    this.guildCommands = new Map(
      await Promise.all(
        guildCommandModules.map(async (module) => {
          const { name, run, aliases = [], description } = (await import(module)) as Command;
          return [
            name,
            {
              name,
              run,
              aliases,
              description,
            },
          ] as [string, Command];
        })
      )
    );
    const dmCommandModules: string[] = await glob(`${__dirname}/dm-commands/**/*.js`);
    this.dmCommands = new Map(
      await Promise.all(
        dmCommandModules.map(async (module) => {
          const { name, run, aliases = [], description } = (await import(module)) as Command;
          return [
            name,
            {
              name,
              run,
              aliases,
              description,
            },
          ] as [string, Command];
        })
      )
    );

    const eventModules: string[] = await glob(`${__dirname}/events/**/*.js`);
    const _this = this;
    await Promise.all(
      eventModules.map(async (module) => {
        const { name, run } = (await import(module)) as Event;
        _this.on(name, run.bind(undefined, _this));
      })
    );

    await this.login(botToken);
  }
}
