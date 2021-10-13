import { Command } from '../bot';
import logger from '@cardstack/logger';
import { DMChannel, GuildMember, Message } from 'discord.js';
import { isBetaTester } from '../utils';

const log = logger('commands:card-me');

export const name: Command['name'] = 'card-me';
export const description: Command['description'] = 'Airdrop Cardstack prepaid cards';
export const run: Command['run'] = async (_client, message) => {
  let member = message.member;
  let guild = message.guild;
  if (!member || !guild) {
    return;
  }
  let dm = await member.createDM();
  // TODO save off this channel ID in DB

  if (!isBetaTester(guild, member)) {
    await sendDM(message, member, dm, `Sorry, I can only give prepaid cards to beta testers.`);
    return;
  }

  // TODO do not send prepaid cards to users that have already received one
  await sendDM(message, member, dm, `Please tell me your card wallet address that will receive your prepaid card`);
};

async function sendDM(message: Message, member: GuildMember, dm: DMChannel, messageStr: string): Promise<void> {
  try {
    await dm.send(messageStr);
  } catch (e) {
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
