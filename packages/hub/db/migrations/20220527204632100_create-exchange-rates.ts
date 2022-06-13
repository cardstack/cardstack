import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

const EXCHANGE_RATES_TABLE = 'exchange_rates';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(EXCHANGE_RATES_TABLE, {
    date: { type: 'date', primaryKey: true, notNull: true },
    from_symbol: { type: 'string', primaryKey: true, notNull: true },
    to_symbol: { type: 'string', primaryKey: true, notNull: true },
    exchange: { type: 'string', primaryKey: true, notNull: true },
    rate: { type: 'numeric', notNull: true },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(EXCHANGE_RATES_TABLE);
}
