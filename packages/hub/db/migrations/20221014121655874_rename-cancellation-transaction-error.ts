/* eslint-disable @typescript-eslint/camelcase */
import { MigrationBuilder } from 'node-pg-migrate';
const TABLE = 'scheduled_payments';

export async function up(pgm: MigrationBuilder): Promise<void> {
    pgm.renameColumn(TABLE, 'cancellation_transaction_error', 'cancelation_transaction_error');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
    pgm.renameColumn(TABLE, 'cancelation_transaction_error', 'cancellation_transaction_error');
}
