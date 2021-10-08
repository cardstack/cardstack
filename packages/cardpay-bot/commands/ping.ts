import { Command } from '../bot';
import config from '../config.json';

export const name: Command['name'] = 'ping';
export const description: Command['description'] = 'Ping command';
export const run: Command['run'] = async (_client, message) => {
  if (!message) {
    return;
  }
  if (message.content === '!ping') {
    message.channel.send('Pong.');
  }

  let betaTesterRole = message.guild?.roles.cache.find((role) => role.name === config.recipientRoleName);
  if (betaTesterRole?.id && message.member?.roles.cache.has(betaTesterRole.id)) {
    console.log(`${message.author.username} is a beta tester`);
  }
};
