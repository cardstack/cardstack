import DiscordBot from '@cardstack/discord-bot';
import { inject } from '@cardstack/di';
import config from 'config';
import { DiscordBotConfig } from '@cardstack/discord-bot/types';
import logger from '@cardstack/logger';
import { runInitializers } from '../../../main';

import * as AirDropPrepaidCardStart from './commands/dm/airdrop-prepaidcard/start';
import * as Ping from './commands/guild/ping';
import * as CardDrop from './commands/guild/card-drop';
import { service } from '@cardstack/hub/services';

const log = logger('hub/bot');

export default class HubBot extends DiscordBot {
  type = 'hub-bot';
  config: DiscordBotConfig = {
    botId: config.get('discord.botId'),
    botToken: config.get('discord.botToken'),
    cordeBotId: config.get('discord.cordeBotId'),
    cordeBotToken: config.get('discord.cordeBotToken'),
    commandPrefix: config.get('discord.commandPrefix'),
    allowedGuilds: config.get('discord.allowedGuilds'),
    allowedChannels: config.get('discord.allowedChannels'),
    messageVerificationDelayMs: config.get('discord.messageVerificationDelayMs'),
  };

  dmCommands = new Map([[AirDropPrepaidCardStart.name, AirDropPrepaidCardStart]]);
  guildCommands = new Map([
    [Ping.name, Ping],
    [CardDrop.name, CardDrop],
  ]);

  inventory = inject('inventory');
  relay = service('relay');
  walletConnect = inject('wallet-connect', { as: 'walletConnect' });
  web3 = inject('web3-http', { as: 'web3' });
  cardpay = inject('cardpay');
  discordBotsDbGateway = inject('hub-discord-bots-db-gateway', { as: 'discordBotsDbGateway' });
  dmChannelsDbGateway = inject('hub-dm-channels-db-gateway', { as: 'dmChannelsDbGateway' });

  constructor() {
    super();
    runInitializers();
  }

  async teardown() {
    log.info('shutting down');
    await this.destroy();
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    hubBot: HubBot;
  }
}
