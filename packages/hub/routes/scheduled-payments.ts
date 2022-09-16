import Koa from 'koa';
import autoBind from 'auto-bind';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '@cardstack/di';
import * as Sentry from '@sentry/node';
import shortUUID from 'short-uuid';
import ScheduledPaymentValidator from '../services/validators/scheduled-payment';
import { serializeErrors } from './utils/error';

import { signatureToVRS } from '@cardstack/cardpay-sdk';
import ScheduledPaymentSerializer from '../services/serializers/scheduled-payment-serializer';
import WorkerClient from '../services/worker-client';
import { timeoutPromise } from '../utils/misc';
import { calculateNextPayAt } from '../utils/scheduled-payments';

export default class ScheduledPaymentsRoute {
  scheduledPaymentValidator: ScheduledPaymentValidator = inject('scheduled-payment-validator', {
    as: 'scheduledPaymentValidator',
  });
  scheduledPaymentSerializer: ScheduledPaymentSerializer = inject('scheduled-payment-serializer', {
    as: 'scheduledPaymentSerializer',
  });
  web3 = inject('web3-http', { as: 'web3' });
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });
  cardpay = inject('cardpay');

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let attrs = ctx.request.body.data.attributes;

    let params = {
      id: shortUUID.uuid(),
      senderSafeAddress: attrs['sender-safe-address'],
      moduleAddress: attrs['module-address'],
      tokenAddress: attrs['token-address'],
      amount: attrs.amount,
      payeeAddress: attrs['payee-address'],
      executionGasEstimation: attrs['execution-gas-estimation'],
      maxGasPrice: attrs['max-gas-price'],
      feeFixedUsd: attrs['fee-fixed-usd'],
      feePercentage: attrs['fee-percentage'],
      salt: attrs['salt'],
      payAt: new Date(attrs['pay-at']),
      recurringDayOfMonth: attrs['recurring-day-of-month'],
      recurringUntil: attrs['recurring-until'],
      validForDays: attrs['valid-for-days'],
      spHash: attrs['sp-hash'],
      chainId: attrs['chain-id'],
      signature: attrs['signature'],
    };

    if (params.recurringDayOfMonth != null) {
      params.payAt = calculateNextPayAt(new Date(), params.recurringDayOfMonth);
    }

    let errors = this.scheduledPaymentValidator.validate(params);
    let hasErrors = Object.values(errors).flatMap((i) => i).length > 0;
    if (hasErrors) {
      ctx.status = 422;
      ctx.body = {
        errors: serializeErrors(errors),
      };
    } else {
      // TODO: prevent double save (was there the same scheduled payment (apart from the salt) already saved recently?)
      let prisma = await this.prismaManager.getClient();
      let scheduledPaymentModule = await this.cardpay.getSDK('ScheduledPaymentModule', this.web3.getInstance());

      // We create the scheduled payment in the database as a first step, so that we can be sure
      // that the scheduled payment *is persisted* in the database before we try to map it with the transaction.
      // We don't want to get into a situation where on chain call is triggered but the scheduled payment
      // wasn't persisted in the database for some reason.
      let scheduledPayment = await prisma.scheduledPayment.create({
        data: params,
      });

      let getTxnHash = new Promise<void>((resolve) => {
        scheduledPaymentModule.schedulePayment(
          params.senderSafeAddress,
          params.moduleAddress,
          params.tokenAddress,
          params.spHash,
          signatureToVRS(params.signature),
          {
            onTxnHash: async (txnHash) => {
              await prisma.scheduledPayment.update({
                where: {
                  id: scheduledPayment.id,
                },
                data: {
                  creationTransactionHash: txnHash,
                },
              });

              // It might take several minutes for the transaction to be mined, so we wait for it in the background. The client
              // can poll the record to see when it's mined (creation_block_number attribute will be set).
              await this.workerClient.addJob('scheduled-payment-on-chain-creation-waiter', {
                scheduledPaymentId: scheduledPayment.id,
              });

              resolve();
            },
          }
        );
      });

      try {
        let isTestEnv = process.env.NODE_ENV === 'test';
        let waitFor = isTestEnv ? 10 : 30 * 1000; // 30 seconds should be enough to get a transaction hash. If not, we'll throw an error.
        await timeoutPromise(getTxnHash, waitFor);
      } catch (error) {
        // If submitting the transaction to the blockchain failed, we don't want to have the scheduled payment in the database.
        await prisma.scheduledPayment.delete({
          where: {
            id: scheduledPayment.id,
          },
        });

        ctx.status = 422;
        ctx.body = 'Error while submitting the scheduled payment creation transaction to the blockchain';
        Sentry.captureException(error);

        return;
      }

      ctx.status = 201;
      // Reload the scheduled payment from the database, so that we have the latest data (the creation transaction hash)
      scheduledPayment = await prisma.scheduledPayment.findFirstOrThrow({
        where: { id: scheduledPayment.id },
      });
      ctx.body = this.scheduledPaymentSerializer.serialize(scheduledPayment);
    }

    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'scheduled-payments-route': ScheduledPaymentsRoute;
  }
}
