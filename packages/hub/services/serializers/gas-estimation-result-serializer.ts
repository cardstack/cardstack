import { GasEstimationResult } from '@prisma/client';
import { JSONAPIDocument } from '../../utils/jsonapi-document';

export default class GasEstimationResultSerializer {
  serialize(model: GasEstimationResult | GasEstimationResult[]): JSONAPIDocument {
    if (Array.isArray(model)) {
      return {
        data: model.map((m) => this.serialize(m).data),
      };
    } else {
      return {
        data: {
          id: model.id,
          type: 'gas-estimation-results',
          attributes: {
            scenario: model.scenario,
            'chain-id': model.chainId,
            'token-address': model.tokenAddress,
            'gas-token-address': model.gasTokenAddress,
            gas: model.gas,
          },
        },
      };
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'gas-estimation-result-serializer': GasEstimationResultSerializer;
  }
}
