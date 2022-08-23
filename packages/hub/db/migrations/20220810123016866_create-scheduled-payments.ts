import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'scheduled_payments';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(TABLE, {
    id: { type: 'uuid', primaryKey: true },
    sender_safe_address: { type: 'string', notNull: true },
    module_address: { type: 'string', notNull: true },
    token_address: { type: 'string', notNull: true },
    amount: { type: 'bigint', notNull: true },
    payee_address: { type: 'string', notNull: true },
    execution_gas_estimation: { type: 'bigint', notNull: true },
    max_gas_price: { type: 'bigint', notNull: true },
    fee_fixed_usd: { type: 'integer', notNull: true },
    fee_percentage: { type: 'integer', notNull: true },
    nonce: { type: 'string', notNull: true },
    pay_at: { type: 'timestamp' },
    recurring_day_of_month: { type: 'integer' },
    recurring_until: { type: 'timestamp' },
    valid_for_days: { type: 'integer', default: 3 },
    sp_hash: { type: 'string', notNull: true, unique: true },
    chain_id: { type: 'integer', notNull: true },
    creation_transaction_hash: { type: 'string' },
    creation_block_number: { type: 'bigint' },
    cancelation_transaction_hash: { type: 'string' },
    cancelation_block_number: { type: 'bigint' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.createIndex(TABLE, ['sender_safe_address']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(TABLE);
}
