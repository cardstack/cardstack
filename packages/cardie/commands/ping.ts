import { Command } from '../types';
import { Message } from 'discord.js';

const ping: Command = {
  name: 'ping',
  description: 'Ping!',
  async execute(message: Message, args: string[]) {
    await message.channel.send(`Pong. ${args.join(' ')}`);
  },
};

export default ping;
