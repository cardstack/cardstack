import { Command } from '../../bot';

export const name: Command['name'] = 'ping';
export const description: Command['description'] = 'Ping command';
export const run: Command['run'] = async (_client, message) => {
  message.channel.send('Pong.');
};
