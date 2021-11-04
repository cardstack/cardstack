import logger from '@cardstack/logger';
import { Message, MockChannel, GuildMember } from '../types';
import { isTestEnv } from './environment';

const log = logger('utils:dm');

export async function createDM(message: Message): Promise<Message['channel'] | MockChannel> {
  if (isTestEnv) {
    return message.channel;
  }
  if (!message.member) {
    throw new Error('Message must have a member');
  }
  return await message.member.createDM();
}

export async function sendDM(
  message: Message,
  member: GuildMember,
  channel: Message['channel'],
  messageStr: string
): Promise<void> {
  try {
    await channel.send(messageStr);
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
