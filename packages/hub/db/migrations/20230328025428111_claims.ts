import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'claims';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(TABLE, {
    id: { type: 'uuid', notNull: true, primaryKey: true },
    chain_id: { type: 'string', notNull: true },
    module_address: { type: 'string', notNull: true },
    type_hash: { type: 'string', notNull: true },
    state_check_struct_name: { type: 'string', notNull: true },
    state_check_type_hash: { type: 'string', notNull: true },
    state_check_data: { type: 'jsonb', notNull: true },
    caller_check_struct_name: { type: 'string', notNull: true },
    caller_check_type_hash: { type: 'string', notNull: true },
    caller_check_data: { type: 'jsonb', notNull: true },
    action_struct_name: { type: 'string', notNull: true },
    action_type_hash: { type: 'string', notNull: true },
    action_data: { type: 'jsonb', notNull: true },
  });
  pgm.createIndex(TABLE, ['caller_check_type_hash']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(TABLE);
}
