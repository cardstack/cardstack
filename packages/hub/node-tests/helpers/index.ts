import { Container } from '@cardstack/di';
import { Clock } from '../../services/clock';

export interface TestEnv {
  container: Container;
  destroy(): Promise<void>;
}

export class AcceleratableClock extends Clock {
  acceleratedByMs = 0;
  get acceleratedByNs(): bigint {
    return BigInt(this.acceleratedByMs) * BigInt(1000);
  }

  now() {
    return Date.now() + this.acceleratedByMs;
  }
  hrNow() {
    return process.hrtime.bigint() + this.acceleratedByNs;
  }
}

export function makeInventoryData(
  sku: string,
  faceValue: string,
  askPrice: string,
  prepaidCards: string[],
  customizationDID = '',
  issuer = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13'
) {
  return {
    askPrice,
    sku: {
      id: sku,
      faceValue,
      customizationDID,
      issuer: {
        id: issuer,
      },
      issuingToken: {
        id: '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
        symbol: 'DAI',
      },
    },
    prepaidCards: prepaidCards.map((prepaidCardId) => ({ prepaidCardId })),
  };
}
