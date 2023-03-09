import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'gas_estimation_results';
const TOKEN_ADDRESS = 'token_address';
const GAS_TOKEN_ADDRESS = 'gas_token_address';
const UNIQUE_CHAIN_AND_SCENARIO = `${TABLE}_unique_chain_and_scenario`;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn(TABLE, {
    [TOKEN_ADDRESS]: { type: 'string', notNull: true, default: '' },
    [GAS_TOKEN_ADDRESS]: { type: 'string', notNull: true, default: '' },
  });

  pgm.dropConstraint(TABLE, UNIQUE_CHAIN_AND_SCENARIO);
  pgm.addConstraint(TABLE, UNIQUE_CHAIN_AND_SCENARIO, {
    unique: ['chain_id', 'scenario', 'token_address', 'gas_token_address'],
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn(TABLE, TOKEN_ADDRESS);
  pgm.dropColumn(TABLE, GAS_TOKEN_ADDRESS);
  pgm.dropConstraint(TABLE, UNIQUE_CHAIN_AND_SCENARIO);
}
