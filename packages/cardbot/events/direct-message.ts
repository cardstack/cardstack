import logger from '@cardstack/logger';
import * as Sentry from '@sentry/node';
import { Event } from '../bot';
import { conversationCommand } from '../utils/dm';

const log = logger('events:direct-message');

export const name: Event['name'] = 'message';
export const run: Event['run'] = async (bot, message) => {
  if (!message || message?.author.bot || message?.guild || message?.channel.type !== 'dm') {
    return;
  }
  let channelId = message.channel.id;

  let db = await bot.databaseManager.getClient();
  let commandName = await conversationCommand(db, channelId);
  if (commandName == null) {
    log.trace(`Ignoring message from ${message.author.username} in ${channelId}`);
    return;
  }

  log.trace(`detected dm we are interested in '${channelId}' from ${message.author.username} about ${commandName}`);
  let command = bot.dmCommands.get(commandName);
  if (!command) {
    log.info(`Ignoring DM from ${message.author.username} in ${channelId} to perform ${commandName}`);
    return;
  }
  let args = [channelId];
  Sentry.addBreadcrumb({ message: `dm command: ${commandName}` });
  try {
    await command.run(bot, message, args);
  } catch (err) {
    log.error(`failed to run command 'handle-dm' with args: ${args.join()}`, err);
    Sentry.withScope(function () {
      Sentry.captureException(err);
    });
  }
};
