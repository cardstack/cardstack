import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '../../di/dependency-injection';
import DatabaseManager from '../database-manager';

interface MerchantInfo {
  id: string;
  name: string;
  slug: string;
  color: string;
  textColor: string;
  ownerAddress: string;
}

interface JSONAPIDocument {
  data: any;
  included?: any[];
}

export default class MerchantInfoSerializer {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async serialize(content: MerchantInfo | string): Promise<JSONAPIDocument> {
    let data: MerchantInfo;
    let did: string;

    if (typeof content === 'string') {
      did = encodeDID({ type: 'MerchantInfo', uniqueId: content });
      data = await this.loadMerchantInfo(content);
    } else {
      did = encodeDID({ type: 'MerchantInfo', uniqueId: content.id });
      data = content;
    }

    const result = {
      data: {
        id: data.id,
        type: 'merchant-infos',
        attributes: {
          did,
          name: data.name,
          slug: data.slug,
          color: data.color,
          textColor: data.textColor,
          ownerAddress: data.ownerAddress,
        },
      },
    };

    return result as JSONAPIDocument;
  }

  async loadMerchantInfo(id: string): Promise<MerchantInfo> {
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
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'merchant-info-serializer': MerchantInfoSerializer;
  }
}
