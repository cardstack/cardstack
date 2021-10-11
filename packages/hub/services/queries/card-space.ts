import DatabaseManager from '../database-manager';
import { inject } from '../../di/dependency-injection';
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
      'INSERT INTO card_spaces (id, url, name, profile_image_url, cover_image_url, description, button_text, category, owner_address) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        model.id,
        model.url,
        model.name,
        model.profileImageUrl,
        model.coverImageUrl,
        model.description,
        model.buttonText,
        model.category,
        model.ownerAddress,
      ]
    );
  }

  async query(filter: CardSpaceQueriesFilter): Promise<CardSpace[]> {
    let db = await this.databaseManager.getClient();

    const conditions = buildConditions(filter);

    const query = `SELECT id, url, name, profile_image_url, cover_image_url, description, button_text, category, owner_address FROM card_spaces WHERE ${conditions.where}`;
    const queryResult = await db.query(query, conditions.values);

    return queryResult.rows.map((row) => {
      return {
        id: row['id'],
        url: row['name'],
        name: row['name'],
        profileImageUrl: row['profile_image_url'],
        coverImageUrl: row['cover_image_url'],
        description: row['description'],
        buttonText: row['button_text'],
        category: row['category'],
        ownerAddress: row['owner_address'],
      };
    });
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'card-space-queries': CardSpaceQueries;
  }
}
