import { ScheduledPayment } from '@prisma/client';
import { JSONAPIDocument } from '../../utils/jsonapi-document';

function transformBigInt(value: BigInt | null): number | null {
  if (value == null) {
    return null;
  } else {
    return Number(value);
  }
}

export default class ScheduledPaymentSerializer {
  serialize(model: ScheduledPayment): JSONAPIDocument {
    const result = {
      data: {
        id: model.id,
        type: 'scheduled-payment',
        attributes: {
          'sender-safe-address': model.senderSafeAddress,
          'module-address': model.moduleAddress,
          'token-address': model.tokenAddress,
          amount: transformBigInt(model.amount),
          'payee-address': model.payeeAddress,
          'execution-gas-estimation': transformBigInt(model.executionGasEstimation),
          'max-gas-price': transformBigInt(model.maxGasPrice),
          'fee-fixed-usd': model.feeFixedUsd,
          'fee-percentage': model.feePercentage,
          salt: model.salt,
          'pay-at': model.payAt,
          'sp-hash': model.spHash,
          'chain-id': model.chainId,
          signature: model.signature,
          'recurring-day-of-month': model.recurringDayOfMonth,
          'recurring-until': model.recurringUntil,
          'creation-transaction-hash': model.creationTransactionHash,
          'creation-block-number': transformBigInt(model.creationBlockNumber),
          'cancelation-transaction-hash': model.cancelationTransactionHash,
          'cancelation-block-number': transformBigInt(model.cancelationBlockNumber),
        },
      },
    };

    return result as JSONAPIDocument;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'scheduled-payment-serializer': ScheduledPaymentSerializer;
  }
}
