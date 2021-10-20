import logger from '@cardstack/logger';
import * as Sentry from '@sentry/node';
import { Event } from '../bot';

const log = logger('events:guild-message');

export const name: Event['name'] = 'message';
export const run: Event['run'] = async (bot, message) => {
  log.trace(`received '${message?.content}'`);
  const { cordeBotId, allowedGuilds: guildsRaw, allowedChannels: channelsRaw, commandPrefix: prefix } = bot.config;
  let allowedGuilds = guildsRaw.split(',');
  let allowedChannels = channelsRaw.split(',');

  if (
    (message?.author.bot && message.author.id !== cordeBotId) ||
    !message?.guild ||
    !allowedGuilds.includes(message.guild.id) ||
    !allowedChannels.includes(message.channel.id) ||
    !message.content.startsWith(prefix)
  )
    return;

  const args: string[] = message.content.slice(prefix.length).trim().split(/ +/);
  let commandName = args.shift();
  if (!commandName) {
    return;
  }
  let command = bot.guildCommands.get(commandName);
  if (!command) {
    return;
  }

  log.trace(`detected command '${commandName}'`);
  Sentry.addBreadcrumb({ message: `guild command: ${commandName}` });
  try {
    await command.run(bot, message, args);
  } catch (err) {
    log.error(`failed to run command '${commandName}' with args: ${args.join(', ')}`, err);
    Sentry.withScope(function () {
      Sentry.captureException(err);
    });
  }
};
