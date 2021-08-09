import Discord from 'discord.js';
import dotenv from 'dotenv';
import config from './config.json';

import { Command } from './types';
import Ping from './commands/ping';
import Deploy from './commands/deploy';

dotenv.config();

const prefix = config.prefix || '!';

const client = new Discord.Client();

const commands = new Discord.Collection<string, Command>();
commands.set('ping', Ping);
commands.set('deploy', Deploy);

client.on('ready', () => {
  if (!client.user) {
    console.error('User not found');
    return;
  }
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async (message: Discord.Message) => {
  if (!message || !message.guild || !config.allowedGuilds.includes(message.guild.id)) return;
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args: string[] = message.content.slice(prefix.length).trim().split(/ +/);

  let commandName = args.shift();
  if (!commandName) {
    return;
  }

  const command = commands.get(commandName.toLowerCase());
  if (!command) {
    const error = `Sorry, unrecognized command ${commandName}`;
    console.log(error);
    await message.reply(error);
    return;
  }

  try {
    await command.execute(message, args);
  } catch (err) {
    console.error(err);
    await message.reply('There was an error trying to execute that command!');
  }
});

client.login(process.env.DISCORD_TOKEN);
