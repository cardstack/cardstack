import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '../../di/dependency-injection';
import DatabaseManager from '../database-manager';
import { MerchantInfo } from '../../routes/merchant-infos';

interface JSONAPIDocument {
  data: any;
  included?: any[];
}

export default class MerchantInfoSerializer {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async serialize(model: MerchantInfo): Promise<JSONAPIDocument> {
    let did = encodeDID({ type: 'MerchantInfo', uniqueId: model.id });

    const result = {
      data: {
        id: model.id,
        type: 'merchant-infos',
        attributes: {
          did,
          name: model.name,
          slug: model.slug,
          color: model.color,
          textColor: model.textColor,
          ownerAddress: model.ownerAddress,
        },
      },
    };

    return result as JSONAPIDocument;
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'merchant-info-serializer': MerchantInfoSerializer;
  }
}
