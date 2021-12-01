import { encodeDID } from '@cardstack/did-resolver';
import { inject } from '@cardstack/di';
import DatabaseManager from '@cardstack/db';
import { MerchantInfo } from '../../routes/merchant-infos';
import config from 'config';

interface JSONAPIDocument {
  data: any;
  included?: any[];
}

export default class MerchantInfoSerializer {
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });

  async serialize(model: MerchantInfo): Promise<JSONAPIDocument> {
    let did = encodeDID({ type: 'MerchantInfo', uniqueId: model.id });

    const result = {
      meta: {
        network: config.get('web3.network'),
      },
      data: {
        id: model.id,
        type: 'merchant-infos',
        attributes: {
          did,
          name: model.name,
          slug: model.slug,
          color: model.color,
          'text-color': model.textColor,
          'owner-address': model.ownerAddress,
        },
      },
    };

    return result as JSONAPIDocument;
  }

  deserialize(json: JSONAPIDocument): MerchantInfo {
    return {
      id: json.data.id,
      name: json.data.attributes['name'],
      slug: json.data.attributes['slug'],
      color: json.data.attributes['color'],
      textColor: json.data.attributes['text-color'],
      ownerAddress: json.data.attributes['owner-address'],
    };
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'merchant-info-serializer': MerchantInfoSerializer;
  }
}
