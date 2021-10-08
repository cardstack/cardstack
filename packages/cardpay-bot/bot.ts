import { Client, Message } from 'discord.js';
import glob from 'glob-promise';
import dotenv from 'dotenv';
import logger from '@cardstack/logger';

export interface RunFunction {
  (client: Bot, message?: Message, args?: string[]): Promise<void>;
}
export interface Command {
  name: string;
  run: RunFunction;
  aliases: string[];
  description: string;
}
export interface Event {
  name: string;
  run: RunFunction;
}

dotenv.config();
const log = logger('bot');
export class Bot extends Client {
  public commands = new Map<string, Command>();

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

    await this.login(process.env.CARDPAY_BOT_TOKEN);
  }
}

(async () => {
  const bot = new Bot();
  await bot.start();
})().catch((e) => log.error('Uncaught error', e));
