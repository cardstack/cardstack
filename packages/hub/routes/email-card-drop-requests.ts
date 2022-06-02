import Koa from 'koa';
import autoBind from 'auto-bind';
import config from 'config';
import { query } from '../queries';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import { ensureLoggedIn } from './utils/auth';
import isEmail from 'validator/lib/isEmail';
import normalizeEmail from 'validator/lib/normalizeEmail';
import crypto from 'crypto';
import cryptoRandomString from 'crypto-random-string';
import * as Sentry from '@sentry/node';
import { NOT_NULL } from '../utils/queries';

const cardDropSku = config.get('cardDrop.sku') as string;

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

  emailCardDropRequestQueries = query('email-card-drop-requests', { as: 'emailCardDropRequestQueries' });
  emailCardDropRequestSerializer = inject('email-card-drop-request-serializer', {
    as: 'emailCardDropRequestSerializer',
  });
  emailCardDropStateQueries = query('email-card-drop-state', { as: 'emailCardDropStateQueries' });
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

    let previousRequests = await this.emailCardDropRequestQueries.query({
      ownerAddress,
    });

    let claimed = previousRequests.some((request) => Boolean(request?.claimedAt));

    let rateLimited = await this.emailCardDropStateQueries.read();

    let result = this.emailCardDropRequestSerializer.serializeEmailCardDropRequestStatus({
      timestamp,
      ownerAddress,
      rateLimited,
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

    let prepaidCardMarketV2 = await this.cardpay.getSDK('PrepaidCardMarketV2', this.web3.getInstance());

    if (await prepaidCardMarketV2.isPaused()) {
      return respondWith503(ctx, 'The prepaid card market contract is paused');
    }

    let quantityAvailable = await prepaidCardMarketV2.getQuantity(cardDropSku);
    let activeReservations = await this.emailCardDropRequestQueries.activeReservations();

    if (quantityAvailable <= activeReservations) {
      return respondWith503(ctx, 'There are no prepaid cards available');
    }

    if (await this.emailCardDropStateQueries.read()) {
      return respondWith503(ctx, 'Rate limit has been triggered');
    }

    let { count, periodMinutes } = config.get('cardDrop.email.rateLimit');
    let countOfRecentClaims = await this.emailCardDropRequestQueries.claimedInLastMinutes(periodMinutes);

    if (countOfRecentClaims >= count) {
      // The rate limit flag must be manually cleared by updating the database
      Sentry.captureException(new Error('Card drop rate limit has been triggered'), {
        level: Sentry.Severity.Fatal,
        tags: {
          event: 'email-card-drop-rate-limit-reached',
        },
      });

      await this.emailCardDropStateQueries.update(true);

      return respondWith503(ctx, 'Rate limit has been triggered');
    }

    let claimedWithUserAddress = await this.emailCardDropRequestQueries.query({
      ownerAddress: ctx.state.userAddress,
      claimedAt: NOT_NULL,
    });

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

    let claimedWithUserEmail = await this.emailCardDropRequestQueries.query({
      emailHash: normalizedEmailHash,
      claimedAt: NOT_NULL,
    });

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
      await this.emailCardDropRequestQueries.insert(emailCardDropRequest);
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
