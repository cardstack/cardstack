import Koa from 'koa';
import autoBind from 'auto-bind';
import { service } from '@cardstack/hub/services';
import { inject } from '@cardstack/di';
import Logger from '@cardstack/logger';
import config from 'config';
import * as Sentry from '@sentry/node';

let log = Logger('route:email-card-drop-verify');

const { url: webClientUrl } = config.get('webClient');
const { alreadyClaimed, error, success } = config.get('webClient.paths.cardDrop');

export default class EmailCardDropVerifyRoute {
  clock = inject('clock');
  emailCardDropRequestSerializer = inject('email-card-drop-request-serializer', {
    as: 'emailCardDropRequestSerializer',
  });
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

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

    let prisma = await this.prismaManager.getClient();

    if (
      await prisma.emailCardDropRequest.count({
        where: {
          ownerAddress,
          claimedAt: {
            not: null,
          },
        },
      })
    ) {
      ctx.redirect(`${webClientUrl}${alreadyClaimed}`);
      return;
    }

    // eoa has not claimed, but this email has already claimed
    if (
      await prisma.emailCardDropRequest.count({
        where: {
          emailHash,
          claimedAt: {
            not: null,
          },
        },
      })
    ) {
      ctx.status = 400;
      ctx.body = 'Email has already been used to claim a prepaid card';
      return;
    }

    let emailCardDropRequest = await prisma.emailCardDropRequest.latestRequestForOwner(ownerAddress, this.clock);

    if (!emailCardDropRequest) {
      ctx.status = 400;
      ctx.body = 'Invalid verification link';
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

    // Optimistically mark the request as claimed to prevent stampede attack
    await prisma.emailCardDropRequest.update({
      data: { claimedAt: new Date(this.clock.now()) },
      where: { id: emailCardDropRequest.id },
    });

    try {
      log.info(`Provisioning prepaid card for ${emailCardDropRequest.ownerAddress}`);
      let transactionHash = await this.relay.provisionPrepaidCardV2(
        emailCardDropRequest.ownerAddress,
        config.get('cardDrop.sku')
      );

      log.info(`Provisioned successfully, transaction hash: ${transactionHash}`);
      await prisma.emailCardDropRequest.update({
        data: { transactionHash },
        where: { id: emailCardDropRequest.id },
      });

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
  }
}

declare module '@cardstack/hub/routes' {
  interface KnownRoutes {
    'email-card-drop-verify': EmailCardDropVerifyRoute;
  }
}
