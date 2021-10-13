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
  commands = new Map<string, Command>();

  async start(): Promise<void> {
    const commandFiles: string[] = await glob(`${__dirname}/commands/**/*.js`);
    this.commands = new Map(
      await Promise.all(
        commandFiles.map(async (file) => {
          const { name, run, aliases = [], description } = (await import(file)) as Command;
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

    const eventFiles: string[] = await glob(`${__dirname}/events/**/*.js`);
    const _this = this;
    await Promise.all(
      eventFiles.map(async (file) => {
        const { name, run } = (await import(file)) as Event;
        _this.on(name, run.bind(undefined, _this));
      })
    );

    await this.login(botToken);
  }
}
