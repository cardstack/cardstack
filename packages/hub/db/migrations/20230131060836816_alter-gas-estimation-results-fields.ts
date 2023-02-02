import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'gas_estimation_results';
const UNIQUE_CHAIN_AND_SCENARIO = `${TABLE}_unique_chain_and_scenario`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint(TABLE, UNIQUE_CHAIN_AND_SCENARIO);
  pgm.dropColumns(TABLE, ['token_address', 'gas_token_address']);
  pgm.addConstraint(TABLE, UNIQUE_CHAIN_AND_SCENARIO, {
    unique: ['chain_id', 'scenario'],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropConstraint(TABLE, UNIQUE_CHAIN_AND_SCENARIO);
}
