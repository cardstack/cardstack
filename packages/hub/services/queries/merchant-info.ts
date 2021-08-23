import DatabaseManager from '../database-manager';
import { inject } from '../../di/dependency-injection';
import { MerchantInfo } from '../../routes/merchant-infos';

export default class MerchantInfoQueries {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async fetch(id: string): Promise<MerchantInfo> {
    let db = await this.databaseManager.getClient();

    let queryResult = await db.query(
      'SELECT id, name, slug, color, text_color, owner_address, created_at from merchant_infos WHERE id = $1',
      [id]
    );

    if (queryResult.rowCount === 0) {
      return Promise.reject(new Error(`No merchant_infos record found with id ${id}`));
    }

    let row = queryResult.rows[0];
    return {
      id: row['id'],
      name: row['name'],
      slug: row['slug'],
      color: row['color'],
      textColor: row['text_color'],
      ownerAddress: row['owner_address'],
    };
  }

  async insert(model: MerchantInfo) {
    let db = await this.databaseManager.getClient();

    await db.query(
      'INSERT INTO merchant_infos (id, name, slug, color, text_color, owner_address) VALUES($1, $2, $3, $4, $5, $6)',
      [model.id, model.name, model.slug, model.color, model.textColor, model.ownerAddress]
    );
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'merchant-info-queries': MerchantInfoQueries;
  }
}
