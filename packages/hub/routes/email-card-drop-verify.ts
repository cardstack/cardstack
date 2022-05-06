import Koa from 'koa';
import autoBind from 'auto-bind';
import { query } from '../queries';
import { inject } from '@cardstack/di';
import config from 'config';

const { url: webClientUrl } = config.get('webClient');
const { alreadyClaimed, success } = config.get('webClient.paths.cardDrop');

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

    if (!ctx.request.query['email-hash']) {
      ctx.status = 400;
      ctx.body = 'email-hash is required';
      return;
    }

    let ownerAddress = ctx.request.query.eoa as string;
    let verificationCode = (ctx.request.query['verification-code'] as string) || '';
    let emailHash = (ctx.request.query['email-hash'] as string) || '';

    // Optimistically mark the request as claimed to prevent stampede attack
    let updatedRequest = await this.emailCardDropRequestQueries.claim({ emailHash, ownerAddress, verificationCode });

    if (updatedRequest) {
      await this.workerClient.addJob('drop-card', {
        id: updatedRequest.id,
      });

      ctx.redirect(`${webClientUrl}${success}`);
      return;
    }

    // If the claim query doesn’t return a record, there no matching record, now determine why

    let emailCardDropRequests = await this.emailCardDropRequestQueries.query({
      ownerAddress,
      verificationCode,
    });

    let emailCardDropRequest = emailCardDropRequests[0];

    if (!emailCardDropRequest) {
      ctx.status = 400;
      ctx.body = 'Code is invalid';
    } else if (emailCardDropRequest.emailHash !== emailHash) {
      ctx.status = 400;
      ctx.body = 'Email is invalid';
    } else if (emailCardDropRequest.claimedAt) {
      ctx.redirect(`${webClientUrl}${alreadyClaimed}`);
      return;
    }

    return;
  }
}

declare module '@cardstack/hub/routes' {
  interface KnownRoutes {
    'email-card-drop-verify': EmailCardDropVerifyRoute;
  }
}
