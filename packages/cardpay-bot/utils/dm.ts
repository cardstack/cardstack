import logger from '@cardstack/logger';
import { DMChannel, GuildMember, Message } from 'discord.js';
import { Client as DBClient } from 'pg';

const log = logger('utils:dm');

export async function sendDM(message: Message, member: GuildMember, dm: DMChannel, messageStr: string): Promise<void> {
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

export async function activateDMConversation(db: DBClient, dm: DMChannel, context: string): Promise<void>;
export async function activateDMConversation(
  db: DBClient,
  channelId: string,
  userId: string,
  command: string
): Promise<void>;
export async function activateDMConversation(
  db: DBClient,
  dmOrChannelId: DMChannel | string,
  userIdOrCommand: string,
  command?: string
): Promise<void> {
  if (typeof dmOrChannelId === 'string' && userIdOrCommand && command) {
    return await updateDMConversationActivity(db, dmOrChannelId, userIdOrCommand, command);
  } else if (typeof dmOrChannelId !== 'string') {
    return await updateDMConversationActivity(db, dmOrChannelId.id, dmOrChannelId.recipient.id, userIdOrCommand);
  }
  throw new Error(`Should never get here`);
}

export async function deactivateDMConversation(db: DBClient, dm: DMChannel): Promise<void>;
export async function deactivateDMConversation(db: DBClient, channelId: string, userId: string): Promise<void>;
export async function deactivateDMConversation(
  db: DBClient,
  dmOrChannelId: DMChannel | string,
  userId?: string
): Promise<void> {
  if (typeof dmOrChannelId === 'string' && userId) {
    return await updateDMConversationActivity(db, dmOrChannelId, userId, null);
  } else if (typeof dmOrChannelId !== 'string') {
    return await updateDMConversationActivity(db, dmOrChannelId.id, dmOrChannelId.recipient.id, null);
  }
  throw new Error(`Should never get here`);
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
