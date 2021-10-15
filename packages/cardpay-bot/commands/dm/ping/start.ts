import { Command } from '../../../bot';
import { deactivateDMConversation } from '../../../utils/dm';

export const name: Command['name'] = 'ping:start';
export const description: Command['description'] = 'DM ping';

export const run: Command['run'] = async (bot, message, [channelId] = []) => {
  let db = await bot.databaseManager.getClient();
  await message.reply('pong');
  await deactivateDMConversation(db, channelId, message.author.id);
};
