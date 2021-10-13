import { Command } from '../../bot';

export const name: Command['name'] = 'airdrop-prepaidcard';
export const description: Command['description'] = 'Collect wallet information to airdrop a prepaid card';
export const run: Command['run'] = async (bot, message, [channelId] = []) => {
  if (!channelId || !message) {
    return;
  }
  let db = await bot.databaseManager.getClient();

  debugger;
};
