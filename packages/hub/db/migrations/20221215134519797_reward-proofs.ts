import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'reward_proofs';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(TABLE, {
    reward_program_id: { type: 'string', notNull: true },
    payee: { type: 'string', notNull: true },
    leaf: { type: 'string', unique: true, notNull: true, primaryKey: true },
    payment_cycle: { type: 'integer', notNull: true },
    proofs: { type: 'text[]', notNull: true },
    token_type: { type: 'integer', notNull: true },
    valid_from: { type: 'integer', notNull: true },
    valid_to: { type: 'integer', notNull: true },
    explanation_id: { type: 'string' },
    explanation_data: { type: 'json' },
  });
  pgm.createIndex(TABLE, ['payee', 'reward_program_id']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(TABLE);
}
