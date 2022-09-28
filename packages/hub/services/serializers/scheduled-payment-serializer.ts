import { ScheduledPayment } from '@prisma/client';
import { JSONAPIDocument } from '../../utils/jsonapi-document';

function transformToString(value: BigInt | null): string | null {
  if (value == null) {
    return null;
  } else {
    return String(value);
  }
}

export default class ScheduledPaymentSerializer {
  serialize(model: ScheduledPayment): JSONAPIDocument {
    const result = {
      data: {
        id: model.id,
        type: 'scheduled-payment',
        attributes: {
          'user-address': model.userAddress,
          'sender-safe-address': model.senderSafeAddress,
          'module-address': model.moduleAddress,
          'token-address': model.tokenAddress,
          amount: transformToString(model.amount),
          'payee-address': model.payeeAddress,
          'execution-gas-estimation': transformToString(model.executionGasEstimation),
          'max-gas-price': transformToString(model.maxGasPrice),
          'fee-fixed-usd': model.feeFixedUsd,
          'fee-percentage': model.feePercentage,
          salt: model.salt,
          'pay-at': model.payAt,
          'sp-hash': model.spHash,
          'chain-id': model.chainId,
          'recurring-day-of-month': model.recurringDayOfMonth,
          'recurring-until': model.recurringUntil,
          'creation-transaction-hash': model.creationTransactionHash,
          'creation-block-number': transformToString(model.creationBlockNumber),
          'creation-transaction-error': model.creationTransactionError,
          'cancelation-transaction-hash': model.cancelationTransactionHash,
          'cancelation-block-number': transformToString(model.cancelationBlockNumber),
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
