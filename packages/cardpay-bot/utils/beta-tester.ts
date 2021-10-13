import { Client as DBClient } from 'pg';

interface BetaTester {
  userId: string;
  userName: string;
  address: string;
  airdropTxnHash: string | null;
  airdropPrepaidCard: string | null;
}

export async function getBetaTester(db: DBClient, userId: string): Promise<BetaTester | undefined> {
  let query = `SELECT EXISTS(SELECT * FROM beta_testers WHERE user_id = $1)`;
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

export async function setBetaTester(db: DBClient, userId: string, userName: string): Promise<void> {
  let query = `INSERT INTO beta_testers (user_id, user_name)
    VALUES ($1, $2)
    ON CONFLICT (user_id)
    DO UPDATE SET
      user_name = $2,
      updated_at = now()`;
  await db.query(query, [userId, userName]);
}
