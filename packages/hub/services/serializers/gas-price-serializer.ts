import { GasPrice } from '@prisma/client';
import { JSONAPIDocument } from '../../utils/jsonapi-document';

export default class GasPriceSerializer {
  serialize(model: GasPrice | GasPrice[]): JSONAPIDocument {
    if (Array.isArray(model)) {
      return {
        data: model.map((m) => this.serialize(m).data),
      };
    } else {
      return {
        data: {
          id: model.id,
          type: 'gas-prices',
          attributes: {
            'chain-id': model.chainId,
            slow: model.slow,
            standard: model.standard,
            fast: model.fast,
          },
        },
      };
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'gas-price-serializer': GasPriceSerializer;
  }
}
