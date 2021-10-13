import logger from '@cardstack/logger';
import { DMChannel, GuildMember, Message } from 'discord.js';
import { Command } from '../bot';
import { activateDMConversation } from '../utils/dm';
import { isBetaTester } from '../utils/guild';

const log = logger('commands:card-me');

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
  // TODO do not send prepaid cards to users that have already received one

  await activateDMConversation(db, dm);
  await sendDM(message, member, dm, `Please tell me your card wallet address that will receive your prepaid card`);
};

async function sendDM(message: Message, member: GuildMember, dm: DMChannel, messageStr: string): Promise<void> {
  try {
    await dm.send(messageStr);
  } catch (e: any) {
    if (e.code === 50007) {
      await message.reply(
        `Please enable 'Allow direct messages from server members' in your privacy settings so that I can DM you.`
      );
    } else {
      log.error(`Error encountered trying to start a DM with member ${member.user.id}`, e);
    }

    return;
  }
}
