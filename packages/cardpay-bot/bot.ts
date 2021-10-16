import { Client, Message } from 'discord.js';
import glob from 'glob-promise';
import config from 'config';
import { inject } from '@cardstack/di';
import { DiscordConfig } from './types';

const { botToken } = config.get('discord') as DiscordConfig;

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
export class Bot extends Client {
  databaseManager = inject('database-manager', { as: 'databaseManager' });
  relay = inject('relay');
  web3 = inject('web3');
  inventory = inject('inventory');
  walletConnect = inject('wallet-connect', { as: 'walletConnect' });
  guildCommands = new Map<string, Command>();
  dmCommands = new Map<string, Command>();

  async start(): Promise<void> {
    this.guildCommands = await gatherCommands(`${__dirname}/commands/guild/**/*.js`);
    this.dmCommands = await gatherCommands(`${__dirname}/commands/dm/**/*.js`);

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

async function gatherCommands(path: string): Promise<Map<string, Command>> {
  const commandModules: string[] = await glob(path);
  return new Map(
    await Promise.all(
      commandModules.map(async (module) => {
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
}
