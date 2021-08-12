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

  async serialize(content: MerchantInfo): Promise<JSONAPIDocument> {
    const did = encodeDID({ type: 'MerchantInfo', uniqueId: content.id });

    const data = {
      id: content.id,
      type: 'merchant-infos',
      attributes: {
        did,
        name: content.name,
        slug: content.slug,
        color: content.color,
        textColor: content.textColor,
        ownerAddress: content.ownerAddress,
      },
    };

    const result = {
      data,
    } as JSONAPIDocument;

    return result;
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'merchant-info-serializer': MerchantInfoSerializer;
  }
}
