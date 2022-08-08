import Koa from 'koa';
import autoBind from 'auto-bind';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '@cardstack/di';
import { validateRequiredFields } from './utils/validation';
import shortUuid from 'short-uuid';
import * as Sentry from '@sentry/node';
import { JobTicket, Profile } from '@prisma/client';

export default class ProfilePurchasesRoute {
  databaseManager = inject('database-manager', { as: 'databaseManager' });
  prismaManager = inject('prisma-manager', { as: 'prismaManager' });
  inAppPurchases = inject('in-app-purchases', { as: 'inAppPurchases' });

  jobTicketSerializer = inject('job-ticket-serializer', { as: 'jobTicketSerializer' });

  merchantInfosRoute = inject('merchant-infos-route', { as: 'merchantInfosRoute' });
  profileSerializer = inject('profile-serializer', {
    as: 'profileSerializer',
  });

  workerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let { provider, receipt } = ctx.request.body.data.attributes || {};
    let sourceArguments = {
      provider,
      receipt,
    };

    let prisma = await this.prismaManager.getClient();
    let alreadyCreatedJobTicket;

    try {
      // prisma does not support postgres' @> object containment operator, so we're using a raw query here
      let rows = await prisma.$queryRaw<JobTicket[]>`
        SELECT * from job_tickets
        WHERE
          job_type = 'create-profile'
          AND owner_address = ${ctx.state.userAddress}
          AND source_arguments @> ${sourceArguments}
        LIMIT 1
      `;
      alreadyCreatedJobTicket = rows[0];
    } catch (e) {
      console.log({ e });
    }
    if (alreadyCreatedJobTicket) {
      ctx.status = 200;
      ctx.body = this.jobTicketSerializer.serialize(alreadyCreatedJobTicket);
      ctx.type = 'application/vnd.api+json';
      return;
    }

    let relationships = ctx.request.body.relationships || {};
    let merchantInfoRelationship = relationships['merchant-info'];

    if (!merchantInfoRelationship) {
      ctx.status = 422;
      ctx.body = {
        errors: [
          {
            status: '422',
            title: 'Missing merchant-infos',
            detail: 'merchant-info relationship must be included',
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    let included = ctx.request.body.included || [];
    let merchantObject = included.find(
      (record: any) =>
        record.type === merchantInfoRelationship.data.type && record.lid === merchantInfoRelationship.data.lid
    );

    if (!merchantObject) {
      ctx.status = 422;
      ctx.body = {
        errors: [
          {
            status: '422',
            title: 'Missing merchant-infos',
            detail: `No included merchant-infos with lid ${merchantInfoRelationship.data.lid} was found`,
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    let merchantAttributes = merchantObject.attributes;

    if (
      !validateRequiredFields(ctx, {
        requiredAttributes: ['name', 'slug', 'color', 'text-color'],
        attributesObject: merchantAttributes,
      })
    ) {
      return;
    }

    if (merchantAttributes.name.length > 50) {
      ctx.status = 422;
      ctx.body = {
        errors: [
          {
            status: '422',
            title: 'Invalid merchant name',
            detail: 'Merchant name cannot exceed 50 characters',
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    let slug = merchantAttributes['slug'].toLowerCase();
    let validationResult = await this.merchantInfosRoute.validateSlug(slug);

    if (!validationResult.slugAvailable) {
      ctx.status = 422;
      ctx.body = {
        errors: [
          {
            status: '422',
            title: 'Invalid merchant slug',
            detail: validationResult.detail,
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    if (
      !validateRequiredFields(ctx, {
        requiredAttributes: ['provider', 'receipt'],
      })
    ) {
      return;
    }

    let alreadyUsedReceipt = await prisma.jobTicket.findFirst({
      where: {
        jobType: 'create-profile',
        sourceArguments: { equals: sourceArguments },
      },
    });

    if (alreadyUsedReceipt) {
      ctx.status = 422;
      ctx.body = {
        errors: [
          {
            status: '422',
            title: 'Invalid purchase receipt',
            detail: 'Purchase receipt is not valid',
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    let { valid: purchaseValidationResult, response: purchaseValidationResponse } = await this.inAppPurchases.validate(
      provider,
      receipt
    );

    if (!purchaseValidationResult) {
      let error = new Error(`Unable to validate purchase, response: ${JSON.stringify(purchaseValidationResponse)}`);
      Sentry.captureException(error, {
        tags: { action: 'profile-purchases-route' },
      });

      ctx.status = 422;
      ctx.body = {
        errors: [
          {
            status: '422',
            title: 'Invalid purchase receipt',
            detail: 'Purchase receipt is not valid',
            meta: purchaseValidationResponse,
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    const merchantInfo: Profile = {
      id: shortUuid.uuid(),
      name: merchantAttributes['name'],
      slug,
      color: merchantAttributes['color'],
      textColor: merchantAttributes['text-color'],
      ownerAddress: ctx.state.userAddress,
      links: [],
      profileDescription: '',
      profileImageUrl: '',
      createdAt: new Date(),
    };

    let db = await this.databaseManager.getClient();

    await this.databaseManager.performTransaction(db, async () => {
      await prisma.profile.create({ data: { ...merchantInfo } });
    });

    let jobTicketId = shortUuid.uuid();

    let insertedJobTicket = await prisma.jobTicket.create({
      data: {
        id: jobTicketId,
        jobType: 'create-profile',
        ownerAddress: ctx.state.userAddress,
        payload: { 'merchant-info-id': merchantInfo.id, 'job-ticket-id': jobTicketId },
        spec: { maxAttempts: 1 },
        sourceArguments,
      },
    });

    this.workerClient.addJob(
      'create-profile',
      { 'merchant-info-id': merchantInfo.id, 'job-ticket-id': jobTicketId },
      { maxAttempts: 1 }
    );

    let serialized = this.profileSerializer.serialize(merchantInfo, 'merchant-infos');

    serialized.included = [this.jobTicketSerializer.serialize(insertedJobTicket!).data];

    ctx.body = serialized;
    ctx.type = 'application/vnd.api+json';
    ctx.status = 201;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'profile-purchases-route': ProfilePurchasesRoute;
  }
}
