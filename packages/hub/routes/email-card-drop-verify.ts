import Koa from 'koa';
import autoBind from 'auto-bind';
import { query } from '../queries';
import { inject } from '@cardstack/di';

export default class EmailCardDropVerifyRoute {
  emailCardDropRequestQueries = query('email-card-drop-requests', { as: 'emailCardDropRequestQueries' });
  emailCardDropRequestSerializer = inject('email-card-drop-request-serializer', {
    as: 'emailCardDropRequestSerializer',
  });

  workerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    if (!ctx.request.query.eoa) {
      ctx.status = 400;
      ctx.body = 'eoa is required';
      return;
    }

    let ownerAddress = ctx.request.query.eoa as string;
    let verificationCode = (ctx.request.query['verification-code'] as string) || '';

    // Optimistically mark the request as claimed to prevent stampede attack
    let updatedRequest = await this.emailCardDropRequestQueries.claim({ ownerAddress, verificationCode });

    if (updatedRequest) {
      await this.workerClient.addJob('drop-card', {
        id: updatedRequest.id,
      });

      ctx.status = 200;
      ctx.body = 'You have verified your card drop request';

      return;
    }

    // If they UPDATE didn’t update anything, find out why

    let emailCardDropRequests = await this.emailCardDropRequestQueries.query({
      ownerAddress,
      verificationCode,
    });

    let emailCardDropRequest = emailCardDropRequests[0];

    if (!emailCardDropRequest) {
      ctx.status = 400;
      ctx.body = 'Code is invalid';
    } else if (emailCardDropRequest.claimedAt) {
      ctx.status = 400;
      ctx.body = 'You have already claimed a card drop';
    }

    return;
  }
}

declare module '@cardstack/hub/routes' {
  interface KnownRoutes {
    'email-card-drop-verify': EmailCardDropVerifyRoute;
  }
}
