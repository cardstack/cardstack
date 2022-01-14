import DiscordBot from '@cardstack/discord-bot';
import HubBot from '..';

export function assertHubBot(bot: DiscordBot): asserts bot is HubBot {
  if (bot.type !== 'hub-bot') {
    throw new Error('Expected a HubBot instance');
  }
}
