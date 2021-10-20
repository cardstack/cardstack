import DiscordBot from '@cardstack/discord-bot';
import { inject } from '@cardstack/di';
import config from 'config';
import { DiscordBotConfig } from '@cardstack/discord-bot/types';

export default class HubBot extends DiscordBot {
  type = 'hub-bot';
  config: DiscordBotConfig = {
    botId: config.get('discord.botId'),
    botToken: config.get('discord.botToken'),
    commandsDir: `${__dirname}/commands`,
    cordeBotId: config.get('discord.cordeBotId'),
    cordeBotToken: config.get('discord.cordeBotToken'),
    commandPrefix: config.get('discord.commandPrefix'),
    allowedGuilds: config.get('discord.allowedGuilds'),
    allowedChannels: config.get('discord.allowedChannels'),
  };

  inventory = inject('inventory');
  relay = inject('relay');
  walletConnect = inject('wallet-connect', { as: 'walletConnect' });
  web3 = inject('web3');
  databaseDelegate = inject('bot-database-delegate', { as: 'databaseDelegate' });
}
