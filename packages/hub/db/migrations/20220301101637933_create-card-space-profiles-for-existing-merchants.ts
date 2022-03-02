import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';
import shortUuid from 'short-uuid';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  let merchantInfoIdsWithoutCardSpaceQuery =
    'SELECT merchant_infos.id FROM merchant_infos LEFT JOIN card_spaces ON merchant_infos.id = card_spaces.merchant_id WHERE card_spaces.merchant_id IS NULL';

  let merchantInfoIdsWithoutCardSpace = (await pgm.db.query(merchantInfoIdsWithoutCardSpaceQuery)).rows.map(
    (row: any) => row.id
  );

  console.log(`Inserting ${merchantInfoIdsWithoutCardSpace.length} card spaces...`);

  let insertValues = merchantInfoIdsWithoutCardSpace
    .map((merchantId: string) => {
      return `('${shortUuid.uuid()}', '${merchantId}')`;
    })
    .join(', ');

  if (insertValues.length === 0) {
    console.log('No card spaces to insert');
    return;
  }

  let insertQuery = `INSERT INTO card_spaces (id, merchant_id) VALUES ${insertValues} RETURNING *`;

  let result = await pgm.db.query(insertQuery);
  console.log(`Inserted ${result.rows.length} card spaces.`);
}

export async function down(): Promise<void> {
  console.log("Cant't easily reverse this migration. Delete card spaces manually if needed.");
}
