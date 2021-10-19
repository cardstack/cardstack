import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { CardSpace } from '../../routes/card-spaces';
import { buildConditions } from '../../utils/queries';

interface CardSpaceQueriesFilter {
  id?: string;
  url?: string;
}

export default class CardSpaceQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async insert(model: CardSpace) {
    let db = await this.databaseManager.getClient();

    await db.query(
      'INSERT INTO card_spaces (id, url, profile_name, profile_image_url, profile_cover_image_url, profile_description, profile_button_text, profile_category, owner_address) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        model.id,
        model.url,
        model.profileName,
        model.profileImageUrl,
        model.profileCoverImageUrl,
        model.profileDescription,
        model.profileButtonText,
        model.profileCategory,
        model.ownerAddress,
      ]
    );
  }

  async update(model: CardSpace) {
    let db = await this.databaseManager.getClient();

    await db.query(
      `UPDATE card_spaces SET
        url = $2,
        profile_name = $3,
        profile_image_url = $4,
        profile_cover_image_url = $5,
        profile_description = $6,
        profile_button_text = $7,
        profile_category = $8,
        bio_title = $9,
        bio_description = $10,
        links = $11,
        donation_title = $12,
        donation_description = $13,
        donation_suggestion_amount_1 = $14,
        donation_suggestion_amount_2 = $15,
        donation_suggestion_amount_3 = $16,
        donation_suggestion_amount_4 = $17,
        merchant_id = $18
      WHERE ID = $1`,
      [
        model.id,
        model.url,
        model.profileName,
        model.profileImageUrl,
        model.profileCoverImageUrl,
        model.profileDescription,
        model.profileButtonText,
        model.profileCategory,
        model.bioTitle,
        model.bioDescription,
        model.links,
        model.donationTitle,
        model.donationDescription,
        model.donationSuggestionAmount1,
        model.donationSuggestionAmount2,
        model.donationSuggestionAmount3,
        model.donationSuggestionAmount4,
        model.merchantId,
      ]
    );
  }

  async query(filter: CardSpaceQueriesFilter): Promise<CardSpace[]> {
    let db = await this.databaseManager.getClient();

    const conditions = buildConditions(filter);

    const query = `SELECT id, url, profile_name, profile_image_url, profile_cover_image_url, profile_description, profile_button_text, profile_category, bio_title, bio_description, donation_title, donation_description, links, donation_suggestion_amount_1, donation_suggestion_amount_2, donation_suggestion_amount_3, donation_suggestion_amount_4, owner_address FROM card_spaces WHERE ${conditions.where}`;
    const queryResult = await db.query(query, conditions.values);

    return queryResult.rows.map((row) => {
      return {
        id: row['id'],
        url: row['url'],
        profileName: row['profile_name'],
        profileImageUrl: row['profile_profile_image_url'],
        profileCoverImageUrl: row['profile_cover_image_url'],
        profileDescription: row['profile_description'],
        profileButtonText: row['profile_button_text'],
        profileCategory: row['profile_category'],
        bioTitle: row['bio_title'],
        bioDescription: row['bio_description'],
        donationTitle: row['donation_title'],
        donationDescription: row['donation_description'],
        links: row['links'],
        donationSuggestionAmount1: row['donation_suggestion_amount_1'],
        donationSuggestionAmount2: row['donation_suggestion_amount_2'],
        donationSuggestionAmount3: row['donation_suggestion_amount_3'],
        donationSuggestionAmount4: row['donation_suggestion_amount_4'],
        ownerAddress: row['owner_address'],
      };
    });
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-space-queries': CardSpaceQueries;
  }
}
