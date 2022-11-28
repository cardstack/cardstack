import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'gas_estimation_results';
const SCENARION_ENUM = `${TABLE}_scenario_enum`;
const UNIQUE_CHAIN_AND_SCENARIO = `${TABLE}_unique_chain_and_scenario`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType(SCENARION_ENUM, ['create_safe_with_module', 'execute_one_time_payment', 'execute_recurring_payment']);

  pgm.createTable(TABLE, {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    chain_id: { type: 'integer', notNull: true },
    scenario: { type: SCENARION_ENUM, notNull: true },
    token_address: { type: 'string', notNull: true, default: '' },
    gas_token_address: { type: 'string', notNull: true, default: '' },
    gas: { type: 'integer', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.addConstraint(TABLE, UNIQUE_CHAIN_AND_SCENARIO, {
    unique: ['chain_id', 'scenario', 'token_address', 'gas_token_address'],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(TABLE);
  pgm.dropType(SCENARION_ENUM);
  pgm.dropConstraint(TABLE, UNIQUE_CHAIN_AND_SCENARIO);
}
