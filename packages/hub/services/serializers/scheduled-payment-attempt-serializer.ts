import { ScheduledPaymentAttemptWithScheduledPayment } from '../../routes/scheduled-payment-attempts';
import { JSONAPIDocument } from '../../utils/jsonapi-document';
import { uniqBy } from 'lodash';
import ScheduledPaymentSerializer from './scheduled-payment-serializer';
import { inject } from '@cardstack/di';

export default class ScheduledPaymentAttemptSerializer {
  scheduledPaymentSerializer: ScheduledPaymentSerializer = inject('scheduled-payment-serializer', {
    as: 'scheduledPaymentSerializer',
  });

  serialize(
    model: ScheduledPaymentAttemptWithScheduledPayment | ScheduledPaymentAttemptWithScheduledPayment[]
  ): JSONAPIDocument {
    if (Array.isArray(model)) {
      return {
        data: model.map((model) => this.serialize(model).data),
        included: uniqBy(model, 'scheduledPayment.id').map((model) => {
          return this.scheduledPaymentSerializer.serialize(model.scheduledPayment).data;
        }),
      };
    } else {
      return {
        data: {
          id: model.id,
          type: 'scheduled-payment-attempts',
          attributes: {
            'started-at': model.startedAt,
            'ended-at': model.endedAt,
            status: model.status,
            'transaction-hash': model.transactionHash,
            'failure-reason': model.failureReason,
            'execution-gas-price': model.executionGasPrice,
          },
          relationships: {
            'scheduled-payment': {
              data: {
                id: model.scheduledPaymentId,
                type: 'scheduled-payments',
              },
            },
          },
        },
      };
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'scheduled-payment-attempt-serializer': ScheduledPaymentAttemptSerializer;
  }
}
