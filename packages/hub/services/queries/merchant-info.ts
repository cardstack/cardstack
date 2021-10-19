import DatabaseManager from '@cardstack/db';
import { inject } from '@cardstack/di';
import { MerchantInfo } from '../../routes/merchant-infos';
import { buildConditions } from '../../utils/queries';

interface MerchantInfoQueriesFilter {
  id?: string;
  slug?: string;
}

export default class MerchantInfoQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async fetch(filter: MerchantInfoQueriesFilter): Promise<MerchantInfo[]> {
    let db = await this.databaseManager.getClient();

    const conditions = buildConditions(filter);

    const query = `SELECT id, name, slug, color, text_color, owner_address, created_at from merchant_infos WHERE ${conditions.where}`;
    const queryResult = await db.query(query, conditions.values);

    return queryResult.rows.map((row) => {
      return {
        id: row['id'],
        name: row['name'],
        slug: row['slug'],
        color: row['color'],
        textColor: row['text_color'],
        ownerAddress: row['owner_address'],
      };
    });
  }

  async insert(model: MerchantInfo) {
    let db = await this.databaseManager.getClient();

    await db.query(
      'INSERT INTO merchant_infos (id, name, slug, color, text_color, owner_address) VALUES($1, $2, $3, $4, $5, $6)',
      [model.id, model.name, model.slug, model.color, model.textColor, model.ownerAddress]
    );
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'merchant-info-queries': MerchantInfoQueries;
  }
}
