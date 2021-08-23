import { Message } from 'discord.js';

interface Command {
  name: string;
  description: string;
  execute(message: Message, args: string[]): Promise<void>;
}

export { Command };
