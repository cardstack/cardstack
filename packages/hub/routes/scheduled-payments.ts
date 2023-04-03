import Koa from 'koa';
import autoBind from 'auto-bind';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '@cardstack/di';
import shortUUID from 'short-uuid';
import ScheduledPaymentValidator from '../services/validators/scheduled-payment';
import { serializeErrors } from './utils/error';
import ScheduledPaymentSerializer from '../services/serializers/scheduled-payment-serializer';
import WorkerClient from '../services/worker-client';
import { calculateNextPayAt } from '../utils/scheduled-payments';
import { ScheduledPayment } from '@prisma/client';
import { nowUtc } from '../utils/dates';

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

  async get(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let userAddress = ctx.state.userAddress;
    let scheduledPaymentId: string = ctx.params.scheduled_payment_id;

    let prisma = await this.prismaManager.getClient();
    let scheduledPayment = await prisma.scheduledPayment.findFirst({
      where: {
        id: scheduledPaymentId,
        userAddress,
      },
    });

    if (scheduledPayment) {
      ctx.body = this.scheduledPaymentSerializer.serialize(scheduledPayment);
      ctx.status = 200;
    } else {
      ctx.status = 404;
    }
    ctx.type = 'application/vnd.api+json';
  }

  async list(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let prisma = await this.prismaManager.getClient();

    let minPayAt = new Date((ctx.query['filter[pay-at][gt]'] as string) || 0);
    let chainId = ctx.query['filter[chain-id]'] ? Number(ctx.query['filter[chain-id]']) : undefined;
    let senderSafeAddress = ctx.query['filter[sender-safe-address]']
      ? String(ctx.query['filter[sender-safe-address]'])
      : undefined;

    let scheduledPayments = await prisma.scheduledPayment.findMany({
      where: {
        userAddress: ctx.state.userAddress,
        senderSafeAddress,
        chainId,
        payAt: {
          gt: minPayAt,
        },
        canceledAt: null,
      },
      orderBy: { payAt: 'asc' },
    });

    ctx.body = this.scheduledPaymentSerializer.serialize(scheduledPayments);
    ctx.status = 200;
    ctx.type = 'application/vnd.api+json';
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let attrs = ctx.request.body.data.attributes;

    let parseDate = (value: string | number) => {
      if (value) {
        if (typeof value === 'string') {
          return new Date(value);
        }

        let date = new Date(0);
        date.setUTCSeconds(value);
        return date;
      } else {
        return null;
      }
    };

    let params = {
      id: shortUUID.uuid(),
      userAddress: ctx.state.userAddress,
      senderSafeAddress: attrs['sender-safe-address'],
      moduleAddress: attrs['module-address'],
      tokenAddress: attrs['token-address'],
      gasTokenAddress: attrs['gas-token-address'],
      amount: attrs.amount,
      payeeAddress: attrs['payee-address'],
      executionGasEstimation: attrs['execution-gas-estimation'],
      maxGasPrice: attrs['max-gas-price'],
      feeFixedUsd: attrs['fee-fixed-usd'],
      feePercentage: attrs['fee-percentage'],
      salt: attrs['salt'],
      spHash: attrs['sp-hash'],
      chainId: attrs['chain-id'],
      payAt: parseDate(attrs['pay-at']),
      recurringDayOfMonth: attrs['recurring-day-of-month'],
      recurringUntil: parseDate(attrs['recurring-until']),
      validForDays: attrs['valid-for-days'],
      privateMemo: attrs['private-memo'],
    } as unknown as ScheduledPayment;

    if (params.recurringDayOfMonth != null && params.recurringUntil != null) {
      params.payAt = calculateNextPayAt(params.recurringDayOfMonth, params.recurringUntil);
    }

    let errors = await this.scheduledPaymentValidator.validate(params);
    let hasErrors = Object.values(errors).flatMap((i) => i).length > 0;
    if (hasErrors) {
      ctx.status = 422;
      ctx.body = {
        errors: serializeErrors(errors),
      };
    } else {
      let prisma = await this.prismaManager.getClient();

      let scheduledPayment = await prisma.scheduledPayment.create({
        data: params,
      });

      ctx.body = this.scheduledPaymentSerializer.serialize(scheduledPayment);
      ctx.status = 201;
      ctx.type = 'application/vnd.api+json';
    }
  }

  async patch(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let userAddress = ctx.state.userAddress;
    let scheduledPaymentId: string = ctx.params.scheduled_payment_id;

    let prisma = await this.prismaManager.getClient();
    let scheduledPayment = await prisma.scheduledPayment.findFirst({
      where: {
        id: scheduledPaymentId,
        userAddress,
      },
    });

    if (!scheduledPayment) return (ctx.status = 404);

    let creationTransactionHash = ctx.request.body.data.attributes['creation-transaction-hash'];
    let cancelationTransactionHash = ctx.request.body.data.attributes['cancelation-transaction-hash'];

    if (creationTransactionHash) {
      scheduledPayment = await prisma.scheduledPayment.update({
        where: {
          id: scheduledPayment.id,
        },
        data: {
          creationTransactionHash,
        },
      });

      await this.workerClient.addJob('scheduled-payment-on-chain-creation-waiter', {
        scheduledPaymentId: scheduledPayment.id,
      });
    } else if (cancelationTransactionHash) {
      scheduledPayment = await prisma.scheduledPayment.update({
        where: {
          id: scheduledPayment.id,
        },
        data: {
          cancelationTransactionHash,
          canceledAt: nowUtc(),
        },
      });

      await this.workerClient.addJob('scheduled-payment-on-chain-cancelation-waiter', {
        scheduledPaymentId: scheduledPayment.id,
      });
    } else {
      ctx.status = 422;
    }

    ctx.body = this.scheduledPaymentSerializer.serialize(scheduledPayment);
    ctx.status = 200;
    ctx.type = 'application/vnd.api+json';

    return; // To avoid "Not all paths return a value" TS error (we have an early 404 return)
  }

  async delete(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let prisma = await this.prismaManager.getClient();

    let userAddress = ctx.state.userAddress;
    let scheduledPaymentId: string = ctx.params.scheduled_payment_id;

    let scheduledPayment = await prisma.scheduledPayment.findFirst({
      where: {
        id: scheduledPaymentId,
        userAddress,
      },
    });

    if (scheduledPayment) {
      await prisma.scheduledPayment.delete({
        where: {
          id: scheduledPaymentId,
        },
      });
      ctx.status = 200;
      ctx.body = {};
    } else {
      ctx.status = 404;
    }

    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'scheduled-payments-route': ScheduledPaymentsRoute;
  }
}
