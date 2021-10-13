import { Command } from '../../bot';
import { sendDM, activateDMConversation } from '../../utils/dm';
import { isBetaTester } from '../../utils/guild';
import { getBetaTester, setBetaTester } from '../../utils/beta-tester';

export const name: Command['name'] = 'card-me';
export const description: Command['description'] = 'Airdrop Cardstack prepaid cards';
export const run: Command['run'] = async (bot, message) => {
  let member = message.member;
  let guild = message.guild;
  if (!member || !guild) {
    return;
  }
  let dm = await member.createDM();

  if (!isBetaTester(guild, member)) {
    await sendDM(message, member, dm, `Sorry, I can only give prepaid cards to beta testers.`);
    return;
  }

  let db = await bot.databaseManager.getClient();
  let betaTester = await getBetaTester(db, member.id);
  if (betaTester?.airdropTxnHash) {
    await sendDM(
      message,
      member,
      dm,
      `You have already been provisioned a prepaid card. If you are having problems accessing it contact an admin for help.`
    );
    return;
  }

  await setBetaTester(db, member.id, member.user.username);
  await activateDMConversation(db, dm, 'airdrop-prepaidcard');
  await sendDM(message, member, dm, `Please tell me your card wallet address that will receive your prepaid card`);
};
