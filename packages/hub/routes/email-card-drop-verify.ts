import Koa from 'koa';
import autoBind from 'auto-bind';
import { query } from '../queries';
import { service } from '@cardstack/hub/services';
import { inject } from '@cardstack/di';
import Logger from '@cardstack/logger';
import config from 'config';
import * as Sentry from '@sentry/node';
import { NOT_NULL } from '../utils/queries';

let log = Logger('route:email-card-drop-verify');

const { url: webClientUrl } = config.get('webClient');
const { alreadyClaimed, error, success } = config.get('webClient.paths.cardDrop');

export default class EmailCardDropVerifyRoute {
  emailCardDropRequestQueries = query('email-card-drop-requests', { as: 'emailCardDropRequestQueries' });
  emailCardDropRequestSerializer = inject('email-card-drop-request-serializer', {
    as: 'emailCardDropRequestSerializer',
  });

  relay = service('relay');
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

    let emailCardDropRequest = (
      await this.emailCardDropRequestQueries.query({
        ownerAddress,
      })
    )[0];

    if (!emailCardDropRequest) {
      ctx.status = 400;
      ctx.body = 'Invalid verification link';
      return;
    }

    // this eoa has already claimed
    if (emailCardDropRequest.claimedAt) {
      ctx.redirect(`${webClientUrl}${alreadyClaimed}`);
      return;
    }

    if (emailCardDropRequest.isExpired) {
      ctx.status = 400;
      ctx.body = 'Verification link is expired';
      return;
    }

    if (!(emailCardDropRequest.verificationCode === verificationCode && emailCardDropRequest.emailHash === emailHash)) {
      ctx.status = 400;
      ctx.body = 'Invalid verification link';
      return;
    }

    // eoa has not claimed, but this email has already claimed
    if (
      (
        await this.emailCardDropRequestQueries.query({
          emailHash,
          claimedAt: NOT_NULL,
        })
      ).length
    ) {
      ctx.status = 400;
      ctx.body = 'Email has already been used to claim a prepaid card';
      return;
    }

    // Optimistically mark the request as claimed to prevent stampede attack
    let updatedRequest = await this.emailCardDropRequestQueries.claim({ emailHash, ownerAddress, verificationCode });

    if (updatedRequest) {
      try {
        log.info(`Provisioning prepaid card for ${updatedRequest.ownerAddress}`);
        let transactionHash = await this.relay.provisionPrepaidCardV2(
          updatedRequest.ownerAddress,
          config.get('cardDrop.sku')
        );

        log.info(`Provisioned successfully, transaction hash: ${transactionHash}`);
        await this.emailCardDropRequestQueries.updateTransactionHash(updatedRequest.id, transactionHash);

        ctx.redirect(`${webClientUrl}${success}`);
        return;
      } catch (e: any) {
        log.error(`Error provisioning prepaid card: ${e.toString()}`);
        Sentry.captureException(e, {
          tags: {
            action: 'drop-card',
            alert: 'web-team',
          },
        });

        ctx.redirect(`${webClientUrl}${error}?message=${encodeURIComponent(e.toString())}`);
        return;
      }
    } else {
      ctx.status = 400;
      ctx.body = 'Invalid verification link';
    }
  }
}

declare module '@cardstack/hub/routes' {
  interface KnownRoutes {
    'email-card-drop-verify': EmailCardDropVerifyRoute;
  }
}
