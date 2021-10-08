import logger from '@cardstack/logger';
import { Event } from '../bot';
import config from '../config.json';

const log = logger('events:message');
const prefix = config.prefix || '!';

export const name: Event['name'] = 'message';
export const run: Event['run'] = async (bot, message) => {
  if (
    message?.author.bot ||
    !message?.guild ||
    !config.allowedGuilds.includes(message.guild.id) ||
    !message.content.startsWith(prefix)
  )
    return;

  const args: string[] = message.content.slice(prefix.length).trim().split(/ +/);
  let commandName = args.shift();
  if (!commandName) {
    return;
  }
  let command = bot.commands.get(commandName);
  if (!command) {
    return;
  }

  log.trace(`detected command '${commandName}'`);
  try {
    await command.run(bot, message, args);
  } catch (err) {
    log.error(`failed to run command '${commandName}' with args: ${args.join(', ')}`, err);
  }
};
