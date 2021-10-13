import logger from '@cardstack/logger';
import { Event } from '../bot';

const log = logger('events:direct-message');

export const name: Event['name'] = 'message';
export const run: Event['run'] = async (bot, message) => {
  if (message?.author.bot || message?.guild || message?.channel.type !== 'dm') return;
  let channelId = message.channel.id;

  // TODO look up channel ID's we are interested in from DB and assert this is one of those

  log.trace(`detected dm we are interested in '${channelId}'`);
  let command = bot.commands.get('handle-dm');
  if (!command) {
    return;
  }
  try {
    await command.run(bot, message, [channelId]);
  } catch (err) {
    log.error(`failed to run command 'handle-dm' with args: [${channelId}]`, err);
  }
};
