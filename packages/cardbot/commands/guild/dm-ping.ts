import { sendDM, activateDMConversation, createDM } from '../../utils/dm';
import { Command } from '../../bot';

export const name: Command['name'] = 'dm-ping';
export const description: Command['description'] = 'Ping command';
export const run: Command['run'] = async (bot, message) => {
  if (!message.member) {
    return;
  }

  let db = await bot.databaseManager.getClient();
  let channel = await createDM(message);
  await activateDMConversation(db, channel.id, message.member.id, 'ping:start');
  await sendDM(message, message.member!, channel, `Hi`);
};
