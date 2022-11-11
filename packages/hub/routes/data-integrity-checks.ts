import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import DataIntegrityChecksScheduledPayments, {
  IntegrityCheckResult,
} from '../services/data-integrity-checks/scheduled-payments';
import config from 'config';

export default class DataIntegrityChecksRoute {
  dataIntegrityCheckScheduledPayments: DataIntegrityChecksScheduledPayments = inject(
    'data-integrity-checks-scheduled-payments',
    {
      as: 'dataIntegrityCheckScheduledPayments',
    }
  );

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    // The middleware converts header names to lower case
    let authorization = ctx.headers['x-data-integrity-checks-authorization'] as string;

    // Checkly's webhookSecret is used in checkly-webhook.ts for authorizing
    // requests to create incidents in statuspage. For convenience, since Checkly will
    // consume this route as well, we use the same secret here to authorize requests to this private route.

    if (authorization !== config.get('checkly.webhookSecret')) {
      ctx.status = 403;
      return;
    }

    let checkName = ctx.params.check_name;
    let checkResult: IntegrityCheckResult | null = null;

    if (checkName === 'scheduled-payments') {
      checkResult = await this.dataIntegrityCheckScheduledPayments.check();
    }

    if (!checkResult) {
      ctx.status = 404;
      return;
    } else {
      ctx.status = 200;
      ctx.body = {
        data: {
          type: 'data-integrity-check',
          attributes: {
            [checkResult.name]: {
              status: checkResult.status,
              message: checkResult.message,
            },
          },
        },
      };
      ctx.type = 'application/vnd.api+json';
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'data-integrity-checks-route': DataIntegrityChecksRoute;
  }
}
