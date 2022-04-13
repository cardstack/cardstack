import { MigrationBuilder } from 'node-pg-migrate';

const TABLE = 'card_spaces';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns(TABLE, [
    'bio_description',
    'bio_title',
    'donation_description',
    'donation_suggestion_amount_1',
    'donation_suggestion_amount_2',
    'donation_suggestion_amount_3',
    'donation_suggestion_amount_4',
    'donation_title',
    'profile_button_text',
    'profile_category',
    'profile_name',
    'profile_cover_image_url',
  ]);
}

export async function down(_pgm: MigrationBuilder): Promise<void> {
  console.log("not defining down migration for card_spaces' unused fields");
}
