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

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns(TABLE, {
    bio_description: { type: 'string' },
    bio_title: { type: 'string' },
    donation_title: { type: 'string' },
    donation_description: { type: 'string' },
    donation_suggestion_amount_1: { type: 'integer' },
    donation_suggestion_amount_2: { type: 'integer' },
    donation_suggestion_amount_3: { type: 'integer' },
    donation_suggestion_amount_4: { type: 'integer' },
    profile_button_text: { type: 'string' },
    profile_category: { type: 'string' },
    profile_name: { type: 'string' },
    profile_cover_image_url: { type: 'string' },
  });
}
