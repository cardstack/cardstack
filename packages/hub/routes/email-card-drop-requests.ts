import Koa from 'koa';
import autoBind from 'auto-bind';
import config from 'config';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import { ensureLoggedIn } from './utils/auth';
import isEmail from 'validator/lib/isEmail';
import normalizeEmail from 'validator/lib/normalizeEmail';
import crypto from 'crypto';
import cryptoRandomString from 'crypto-random-string';
import * as Sentry from '@sentry/node';
import logger from '@cardstack/logger';
import BN from 'bn.js';
import { ExtendedPrismaClient } from '../services/prisma-manager';
import { SeverityLevel } from '@sentry/node';

const log = logger('hub/email-card-drop-requests');

const cardDropSku = config.get<string>('cardDrop.sku');
const notifyWhenQuantityBelow = config.get<number>('cardDrop.email.notifyWhenQuantityBelow');

export interface EmailCardDropRequest {
  id: string;
  ownerAddress: string;
  emailHash: string;
  verificationCode: string;
  claimedAt?: Date;
  requestedAt: Date;
  transactionHash?: string;
}

export default class EmailCardDropRequestsRoute {
  cardpay = inject('cardpay');
  databaseManager = inject('database-manager', { as: 'databaseManager' });
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });

  emailCardDropRequestSerializer = inject('email-card-drop-request-serializer', {
    as: 'emailCardDropRequestSerializer',
  });
  clock = inject('clock');

  web3 = inject('web3-http', { as: 'web3' });
  workerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let timestamp = new Date(this.clock.now());
    let ownerAddress = ctx.request.query['eoa'] as string;

    if (!ownerAddress) {
      ctx.status = 400;
      ctx.body = {
        errors: [
          {
            code: '400',
            title: 'Missing required parameter: eoa',
            detail: 'Please provide an ethereum address via the eoa query parameter',
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    let prisma = await this.prismaManager.getClient();

    let previousRequests = await prisma.emailCardDropRequest.findManyWithExpiry(
      {
        where: {
          ownerAddress,
        },
      },
      this.clock
    );

    let claimed = previousRequests.some((request) => Boolean(request?.claimedAt));

    let rateLimited = await prisma.emailCardDropState.read();

    let prepaidCardMarketV2 = await this.cardpay.getSDK('PrepaidCardMarketV2', this.web3.getInstance());

    let available = true;

    if (await prepaidCardMarketV2.isPaused()) {
      available = false;
    } else if (await this.getPrepaidCardReservationsAreUnavailable(prisma)) {
      available = false;
    }

    let showBanner = available && !rateLimited && !claimed;

    let result = this.emailCardDropRequestSerializer.serializeEmailCardDropRequestStatus({
      timestamp,
      ownerAddress,
      available,
      rateLimited,
      showBanner,
      claimed,
    });

    ctx.status = 200;
    ctx.body = result;
    ctx.type = 'application/vnd.api+json';
    return;
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    ctx.type = 'application/vnd.api+json';

    let prisma = await this.prismaManager.getClient();
    let prepaidCardMarketV2 = await this.cardpay.getSDK('PrepaidCardMarketV2', this.web3.getInstance());

    if (await prepaidCardMarketV2.isPaused()) {
      return respondWith503(ctx, 'The prepaid card market contract is paused');
    }

    let quantityAvailable = await this.getPrepaidCardQuantityAvailable();
    let activeReservations = await this.getActiveReservations(prisma);
    let unreserved = quantityAvailable.sub(activeReservations);

    let supplyIsBelowNotificationThreshold = unreserved.lt(new BN(notifyWhenQuantityBelow));

    log.info(
      `${cardDropSku} has ${quantityAvailable} available and ${activeReservations} reserved, notification threshold is ${notifyWhenQuantityBelow}`
    );

    if (supplyIsBelowNotificationThreshold) {
      Sentry.captureException(
        new Error(
          `https://app.gitbook.com/o/-MlRBKglR9VL1a7e4w85/s/05zPo3R26oH9uKrNVxni/hub/email-card-drop#quantity-threshold-warning Prepaid card quantity (${quantityAvailable}) less reservations (${activeReservations}) is below cardDrop.email.notifyWhenQuantityBelow threshold of ${notifyWhenQuantityBelow}`
        ),
        {
          tags: {
            action: 'drop-card',
            alert: 'prepaid-card-supply',
          },
        }
      );
    }

    if (await this.getPrepaidCardReservationsAreUnavailable(prisma)) {
      return respondWith503(ctx, 'There are no prepaid cards available');
    }

    if (await prisma.emailCardDropState.read()) {
      return respondWith503(ctx, 'Rate limit has been triggered');
    }

    let { count, periodMinutes } = config.get<Record<string, number>>('cardDrop.email.rateLimit');
    let countOfRecentClaims = await prisma.emailCardDropRequest.claimedInLastMinutes(periodMinutes, this.clock);

    if (countOfRecentClaims >= count) {
      // The rate limit flag must be manually cleared by updating the database
      Sentry.captureException(new Error('Card drop rate limit has been triggered'), {
        level: 'fatal' as SeverityLevel,
        tags: {
          event: 'email-card-drop-rate-limit-reached',
        },
      });

      await prisma.emailCardDropState.updateState(true);

      return respondWith503(ctx, 'Rate limit has been triggered');
    }

    let claimedWithUserAddress = await prisma.emailCardDropRequest.findManyWithExpiry(
      {
        where: {
          ownerAddress: ctx.state.userAddress,
          claimedAt: { not: null },
        },
      },
      this.clock
    );

    if (claimedWithUserAddress.length > 0) {
      ctx.status = 422;
      ctx.body = {
        errors: [
          {
            status: '422',
            title: 'Address has already claimed a prepaid card',
          },
        ],
      };

      return;
    }

    let email = ctx.request.body.data.attributes.email;
    let normalizedEmail = normalizeEmail(email);

    if (!isEmail(email) || !normalizedEmail) {
      ctx.status = 422;
      ctx.body = {
        errors: [
          {
            detail: 'Email address is not valid',
            source: { pointer: '/data/attributes/email' },
            status: '422',
            title: 'Invalid attribute',
          },
        ],
      };

      return;
    }

    let hash = crypto.createHmac('sha256', config.get('emailHashSalt'));
    hash.update(normalizedEmail);
    let normalizedEmailHash = hash.digest('hex');

    let claimedWithUserEmail = await prisma.emailCardDropRequest.findManyWithExpiry(
      {
        where: {
          emailHash: normalizedEmailHash,
          claimedAt: { not: null },
        },
      },
      this.clock
    );

    if (claimedWithUserEmail.length > 0) {
      ctx.status = 422;
      ctx.body = {
        errors: [
          {
            status: '422',
            title: 'Email has already claimed a prepaid card',
            pointer: '/data/attributes/email',
          },
        ],
      };

      return;
    }

    let verificationCode = generateVerificationCode();

    const emailCardDropRequest: EmailCardDropRequest = {
      id: shortUuid.uuid(),
      ownerAddress: ctx.state.userAddress,
      emailHash: normalizedEmailHash,
      verificationCode,
      requestedAt: new Date(this.clock.now()),
    };

    let db = await this.databaseManager.getClient();

    await this.databaseManager.performTransaction(db, async () => {
      await prisma.emailCardDropRequest.create({ data: emailCardDropRequest });
    });

    await this.workerClient.addJob('send-email-card-drop-verification', {
      id: emailCardDropRequest.id,
      email,
    });

    await this.workerClient.addJob(
      'subscribe-email',
      { email },
      // for the most part, Mailchimp errors will not be retriable
      // because of that we limit maxAttempts to 1
      // this prevents us from retrying where we cannot do anything
      // and also leaves dead jobs in the db that we can check later
      // this should be supplemented by the Mailchimp errors being sent
      // to Sentry and having appropriate alerts, especially for rate limiting
      // could consider permanently failing the job from within conditionally, instead. probably as a utility function?
      // https://github.com/graphile/worker/blob/e3176eab42ada8f4f3718192bada776c22946583/sql/000004.sql#L122-L126
      {
        maxAttempts: 1,
      }
    );

    let serialized = this.emailCardDropRequestSerializer.serialize(emailCardDropRequest);

    ctx.status = 201;
    ctx.body = serialized;
  }

  private async getMarketContract() {
    return await this.cardpay.getSDK('PrepaidCardMarketV2', this.web3.getInstance());
  }

  private async getPrepaidCardQuantityAvailable() {
    return new BN(await (await this.getMarketContract()).getQuantity(cardDropSku));
  }

  private async getActiveReservations(prisma: ExtendedPrismaClient) {
    return new BN(await prisma.emailCardDropRequest.activeReservations(this.clock));
  }

  private async getPrepaidCardReservationsAreUnavailable(prisma: ExtendedPrismaClient) {
    return (await this.getPrepaidCardQuantityAvailable()).lte(await this.getActiveReservations(prisma));
  }
}

function generateVerificationCode() {
  return cryptoRandomString({ length: 10, type: 'url-safe' });
}

function respondWith503(ctx: Koa.Context, message: string) {
  ctx.status = 503;
  ctx.body = {
    errors: [{ status: '503', title: message }],
  };
}

declare module '@cardstack/di' {
  interface KnownServices {
    'email-card-drop-requests-route': EmailCardDropRequestsRoute;
  }
}
