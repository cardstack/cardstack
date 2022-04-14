import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { Client } from 'pg';
import { CardSpace } from '../routes/card-spaces';
import { buildConditions } from '../utils/queries';

interface CardSpaceQueriesFilter {
  id?: string;
  merchantSlug?: string;
  merchantId?: string;
}

export default class CardSpaceQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async insert(model: CardSpace, db?: Client): Promise<CardSpace> {
    if (!db) db = await this.databaseManager.getClient();

    let {
      rows: [{ id }],
    } = await db.query(
      'INSERT INTO card_spaces (id, merchant_id, profile_image_url, profile_description) VALUES($1, $2, $3, $4) RETURNING *',
      [model.id, model.merchantId, model.profileImageUrl, model.profileDescription]
    );

    return { id } as CardSpace;
  }

  async update(model: CardSpace) {
    let db = await this.databaseManager.getClient();

    await db.query(
      `UPDATE card_spaces SET
        profile_image_url = $2,
        profile_description = $3,
        links = $4
      WHERE ID = $1`,
      [model.id, model.profileImageUrl, model.profileDescription, model.links]
    );
  }

  async query(filter: CardSpaceQueriesFilter): Promise<CardSpace[]> {
    let db = await this.databaseManager.getClient();

    let conditions;

    if (filter.merchantSlug != null) {
      conditions = buildConditions({ slug: filter.merchantSlug }, 'merchant_infos');
    } else {
      conditions = buildConditions(filter, 'card_spaces');
    }

    const query = `SELECT card_spaces.id, profile_image_url, profile_description, links, merchant_infos.id as merchant_id, name, owner_address FROM card_spaces JOIN merchant_infos ON card_spaces.merchant_id = merchant_infos.id WHERE ${conditions.where}`;
    const queryResult = await db.query(query, conditions.values);

    return queryResult.rows.map((row) => {
      return {
        id: row['id'],
        profileImageUrl: row['profile_image_url'],
        profileDescription: row['profile_description'],
        links: row['links'],
        merchantId: row['merchant_id'],
        merchantName: row['name'],
        merchantOwnerAddress: row['owner_address'],
      };
    });
  }
}

declare module '@cardstack/hub/queries' {
  interface KnownQueries {
    'card-space': CardSpaceQueries;
  }
}
