import { Client, MessageEmbed } from 'discord.js';
import glob from 'glob-promise';
import { BotDatabaseDelegate, DiscordBotConfig } from './types';
import tmp from 'tmp';
import QRCode from 'qrcode';
import { basename } from 'path';
import DatabaseManager from '@cardstack/db';
import { Message } from './types';
import logger from '@cardstack/logger';

const log = logger('bot:main');

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
  config!: DiscordBotConfig;
  databaseDelegate!: BotDatabaseDelegate;
  guildCommands = new Map<string, Command>();
  dmCommands = new Map<string, Command>();
  isConfigured = false;
  type = 'generic';

  async start(): Promise<void> {
    if (!this.config) {
      throw new Error('config property must be set before starting the bot');
    }
    if (!this.databaseDelegate) {
      throw new Error('databaseDelegate property must be set before starting the bot');
    }

    this.guildCommands = await gatherCommands(`${this.config.commandsDir}/guild/**/*.js`);
    this.dmCommands = await gatherCommands(`${this.config.commandsDir}/dm/**/*.js`);
    if (this.guildCommands.size === 0 && this.dmCommands.size === 0) {
      throw new Error('No bot commands found. Check your configuration.');
    }

    const eventModules: string[] = await glob(`${__dirname}/events/**/*.js`);
    await Promise.all(
      eventModules.map(async (module) => {
        const { name, run } = (await import(module)) as Event;
        this.on(name, run.bind(undefined, this));
      })
    );

    if (this.config.botToken) {
      await this.login(this.config.botToken);
    } else {
      log.info('No bot token found. Bot will not login to discord.');
    }
  }

  getDatabaseClient() {
    return this.databaseDelegate.getDatabaseClient();
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
