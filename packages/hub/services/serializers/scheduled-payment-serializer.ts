import { ScheduledPayment } from '@prisma/client';
import { JSONAPIDocument } from '../../utils/jsonapi-document';

export default class ScheduledPaymentSerializer {
  serialize(model: ScheduledPayment | ScheduledPayment[]): JSONAPIDocument {
    if (Array.isArray(model)) {
      return {
        data: model.map((m) => this.serialize(m).data),
      };
    } else {
      return {
        data: {
          id: model.id,
          type: 'scheduled-payments',
          attributes: {
            'user-address': model.userAddress,
            'sender-safe-address': model.senderSafeAddress,
            'module-address': model.moduleAddress,
            'token-address': model.tokenAddress,
            'gas-token-address': model.gasTokenAddress,
            amount: model.amount,
            'payee-address': model.payeeAddress,
            'execution-gas-estimation': model.executionGasEstimation,
            'max-gas-price': model.maxGasPrice,
            'fee-fixed-usd': model.feeFixedUsd,
            'fee-percentage': model.feePercentage,
            salt: model.salt,
            'pay-at': model.payAt,
            'sp-hash': model.spHash,
            'chain-id': model.chainId,
            'recurring-day-of-month': model.recurringDayOfMonth,
            'recurring-until': model.recurringUntil,
            'creation-transaction-hash': model.creationTransactionHash,
            'creation-block-number': model.creationBlockNumber,
            'creation-transaction-error': model.creationTransactionError,
            'cancelation-transaction-hash': model.cancelationTransactionHash,
            'cancelation-block-number': model.cancelationBlockNumber,
          },
        },
      };
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'scheduled-payment-serializer': ScheduledPaymentSerializer;
  }
}
