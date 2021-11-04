import { Command } from '@cardstack/discord-bot/bot';
import Client, { Message } from '@cardstack/discord-bot';

export const name: Command['name'] = 'ping';
export const description: Command['description'] = 'Ping command';
export const run: Command['run'] = async (_client: Client, message: Message) => {
  message.channel.send('pong');
};
