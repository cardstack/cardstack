import { DMChannel } from 'discord.js';
import { Client as DBClient } from 'pg';

export async function activateDMConversation(db: DBClient, dm: DMChannel): Promise<void> {
  return await updateDMConversationActivity(db, dm, true);
}

export async function deactivateDMConversation(db: DBClient, dm: DMChannel): Promise<void> {
  return await updateDMConversationActivity(db, dm, false);
}

async function updateDMConversationActivity(db: DBClient, dm: DMChannel, isActive: boolean): Promise<void> {
  await db.query(
    `INSERT INTO dm_channels (
           channel_id, user_id, active
         ) VALUES ($1, $2, $3)
         ON CONFLICT (channel_id)
         DO UPDATE SET
           active = $3,
           updated_at = now()`,
    [dm.id, dm.recipient.id, isActive]
  );
}
