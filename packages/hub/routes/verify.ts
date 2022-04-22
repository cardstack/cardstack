import Koa from 'koa';
import autoBind from 'auto-bind';
import { query } from '../queries';
import { inject } from '@cardstack/di';

export default class EmailCardDropVerifyRoute {
  emailCardDropRequestQueries = query('email-card-drop-requests', { as: 'emailCardDropRequestQueries' });
  emailCardDropRequestSerializer = inject('email-card-drop-request-serializer', {
    as: 'emailCardDropRequestSerializer',
  });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    // FIXME these typings!
    let ownerAddress = ctx.request.query.eoa as string;
    let verificationCode = ctx.request.query['verification-code'] as string;

    let emailCardDropRequests = await this.emailCardDropRequestQueries.query({
      ownerAddress,
      verificationCode,
    });

    let emailCardDropRequest = emailCardDropRequests[0];

    if (emailCardDropRequest.claimedAt) {
      ctx.status = 400;
      ctx.body = 'You have already claimed a card drop';
    } else {
      await this.emailCardDropRequestQueries.claim(emailCardDropRequest);

      ctx.status = 200;
      ctx.body = 'You have verified your card drop request';
    }

    return;
  }
}

declare module '@cardstack/hub/routes' {
  interface KnownRoutes {
    verify: EmailCardDropVerifyRoute;
  }
}
