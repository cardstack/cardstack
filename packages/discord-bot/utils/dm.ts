import logger from '@cardstack/logger';
import { Message, MockChannel, GuildMember } from '../types';
import { Client as DBClient } from 'pg';
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

export async function activateDMConversation(
  db: DBClient,
  channelId: string,
  userId: string,
  command: string
): Promise<void> {
  return await updateDMConversationActivity(db, channelId, userId, command);
}

export const continueDMConversation = activateDMConversation;

export async function deactivateDMConversation(db: DBClient, channelId: string, userId: string): Promise<void> {
  return await updateDMConversationActivity(db, channelId, userId, null);
}

export async function conversationCommand(db: DBClient, channelId: string): Promise<string | undefined> {
  let { rows } = await db.query(`SELECT command from dm_channels where channel_id = $1`, [channelId]);
  if (rows.length === 0) {
    return;
  }

  let [{ command }] = rows;
  return command;
}

async function updateDMConversationActivity(
  db: DBClient,
  channelId: string,
  userId: string,
  command: string | null
): Promise<void> {
  await db.query(
    `INSERT INTO dm_channels (
           channel_id, user_id, command
         ) VALUES ($1, $2, $3)
         ON CONFLICT (channel_id)
         DO UPDATE SET
           command = $3,
           updated_at = now()`,
    [channelId, userId, command]
  );
}
