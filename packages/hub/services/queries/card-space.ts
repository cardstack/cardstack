import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { CardSpace } from '../../routes/card-spaces';
import { buildConditions } from '../../utils/queries';

interface CardSpaceQueriesFilter {
  id?: string;
  ownerAddress?: string;
}

export default class CardSpaceQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async insert(model: CardSpace) {
    let db = await this.databaseManager.getClient();

    await db.query(
      'INSERT INTO card_spaces (id, merchant_id, profile_name, profile_image_url, profile_cover_image_url, profile_description, profile_button_text, profile_category) VALUES($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        model.id,
        model.merchantId,
        model.profileName,
        model.profileImageUrl,
        model.profileCoverImageUrl,
        model.profileDescription,
        model.profileButtonText,
        model.profileCategory,
      ]
    );
  }

  async update(model: CardSpace) {
    let db = await this.databaseManager.getClient();

    await db.query(
      `UPDATE card_spaces SET
        profile_name = $2,
        profile_image_url = $3,
        profile_cover_image_url = $4,
        profile_description = $5,
        profile_button_text = $6,
        profile_category = $7,
        bio_title = $8,
        bio_description = $9,
        links = $10,
        donation_title = $11,
        donation_description = $12,
        donation_suggestion_amount_1 = $13,
        donation_suggestion_amount_2 = $14,
        donation_suggestion_amount_3 = $15,
        donation_suggestion_amount_4 = $16
      WHERE ID = $1`,
      [
        model.id,
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
      ]
    );
  }

  async query(filter: CardSpaceQueriesFilter): Promise<CardSpace[]> {
    let db = await this.databaseManager.getClient();

    const conditions = buildConditions(filter, 'card_spaces');

    const query = `SELECT card_spaces.id, profile_name, profile_image_url, profile_cover_image_url, profile_description, profile_button_text, profile_category, bio_title, bio_description, donation_title, donation_description, links, donation_suggestion_amount_1, donation_suggestion_amount_2, donation_suggestion_amount_3, donation_suggestion_amount_4, merchant_infos.id as merchant_id, name, owner_address FROM card_spaces JOIN merchant_infos ON card_spaces.merchant_id = merchant_infos.id WHERE ${conditions.where}`;
    const queryResult = await db.query(query, conditions.values);

    return queryResult.rows.map((row) => {
      return {
        id: row['id'],
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
        merchantId: row['merchant_id'],
        merchantName: row['name'],
        merchantOwnerAddress: row['owner_address'],
      };
    });
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-space-queries': CardSpaceQueries;
  }
}
