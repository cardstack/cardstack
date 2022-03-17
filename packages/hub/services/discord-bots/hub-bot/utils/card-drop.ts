import { Client as DBClient } from 'pg';

interface CardDropRecipient {
  userId: string;
  userName: string;
  address: string;
  airdropTxnHash: string | null;
  airdropPrepaidCard: string | null;
}

export async function getCardDropRecipient(db: DBClient, userId: string): Promise<CardDropRecipient | undefined> {
  let query = `SELECT * FROM card_drop_recipients WHERE user_id = $1`;
  let { rows } = await db.query(query, [userId]);
  if (rows.length === 0) {
    return undefined;
  }
  let [{ user_name: userName, address, airdrop_txn_hash: airdropTxnHash, airdrop_prepaid_card: airdropPrepaidCard }] =
    rows;
  return {
    userId,
    userName,
    address,
    airdropTxnHash,
    airdropPrepaidCard,
  };
}

export async function setCardDropRecipient(db: DBClient, userId: string, userName: string): Promise<void> {
  let query = `INSERT INTO card_drop_recipients (user_id, user_name)
    VALUES ($1, $2)
    ON CONFLICT (user_id)
    DO UPDATE SET
      user_name = $2,
      updated_at = now()`;
  await db.query(query, [userId, userName]);
}

export async function setCardDropRecipientAddress(db: DBClient, userId: string, address: string): Promise<void> {
  let query = `UPDATE card_drop_recipients SET address = $2 WHERE user_id = $1`;
  await db.query(query, [userId, address]);
}

export async function setCardDropRecipientAirdropTxnHash(db: DBClient, userId: string, txnHash: string): Promise<void> {
  let query = `UPDATE card_drop_recipients SET airdrop_txn_hash = $2 WHERE user_id = $1`;
  await db.query(query, [userId, txnHash]);
}

export async function setCardDropRecipientAirdropPrepaidCard(
  db: DBClient,
  userId: string,
  prepaidCard: string
): Promise<void> {
  let query = `UPDATE card_drop_recipients SET airdrop_prepaid_card = $2 WHERE user_id = $1`;
  await db.query(query, [userId, prepaidCard]);
}

export async function existsCardDropRecipientWithTransactionHash(db: DBClient, address: string): Promise<boolean> {
  let query = `SELECT * FROM card_drop_recipients WHERE airdrop_txn_hash IS NOT NULL AND address = $1`;
  let { rows } = await db.query(query, [address]);
  return rows.length > 0;
}
