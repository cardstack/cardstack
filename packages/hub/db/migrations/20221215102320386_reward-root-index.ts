import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'reward_root_index';
const UNIQUE_REWARD_PROGRAM_ID_AND_PAYMENT_CYCLE = `${TABLE}_unique_reward_program_id_and_payment_cycle`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(TABLE, {
    reward_program_id: { type: 'string', notNull: true },
    payment_cycle: { type: 'integer', notNull: true },
  });
  pgm.addConstraint(TABLE, UNIQUE_REWARD_PROGRAM_ID_AND_PAYMENT_CYCLE, {
    unique: ['reward_program_id', 'payment_cycle'],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(TABLE);
  pgm.dropConstraint(TABLE, UNIQUE_REWARD_PROGRAM_ID_AND_PAYMENT_CYCLE);
}
