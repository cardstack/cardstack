import Koa from 'koa';
import autoBind from 'auto-bind';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '@cardstack/di';
import { query } from '@cardstack/hub/queries';
import { CardSpace } from './card-spaces';
import { MerchantInfo } from './merchant-infos';
import { validateRequiredFields } from './utils/validation';
import shortUuid from 'short-uuid';

export default class ProfilePurchasesRoute {
  databaseManager = inject('database-manager', { as: 'databaseManager' });

  cardSpaceQueries = query('card-space', { as: 'cardSpaceQueries' });

  inAppPurchases = inject('in-app-purchases', { as: 'inAppPurchases' });

  jobTicketsQueries = query('job-tickets', { as: 'jobTicketsQueries' });
  jobTicketSerializer = inject('job-ticket-serializer', { as: 'jobTicketSerializer' });

  merchantInfosRoute = inject('merchant-infos-route', { as: 'merchantInfosRoute' });
  merchantInfoSerializer = inject('merchant-info-serializer', {
    as: 'merchantInfoSerializer',
  });
  merchantInfoQueries = query('merchant-info', {
    as: 'merchantInfoQueries',
  });

  workerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let relationships = ctx.request.body.relationships || {};
    let merchantInfoRelationship = relationships['merchant-info'];

    if (!merchantInfoRelationship) {
      ctx.status = 422;
      ctx.body = {
        status: '422',
        title: 'Missing merchant-infos',
        detail: 'merchant-info relationship must be included',
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
        status: '422',
        title: 'Missing merchant-infos',
        detail: `No included merchant-infos with lid ${merchantInfoRelationship.data.lid} was found`,
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    let merchantAttributes = merchantObject.attributes;

    if (
      !validateRequiredFields(ctx, {
        requiredAttributes: ['name', 'slug', 'color'],
        attributesObject: merchantAttributes,
      })
    ) {
      return;
    }

    if (merchantAttributes.name.length > 50) {
      ctx.status = 422;
      ctx.body = {
        status: '422',
        title: 'Invalid merchant name',
        detail: 'Merchant name cannot exceed 50 characters',
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    let slug = merchantAttributes['slug'].toLowerCase();
    let validationResult = await this.merchantInfosRoute.validateSlug(slug);

    if (!validationResult.slugAvailable) {
      ctx.status = 422;
      ctx.body = {
        status: '422',
        title: 'Invalid merchant slug',
        detail: validationResult.detail,
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

    let { provider, receipt } = ctx.request.body.data.attributes;

    let { valid: purchaseValidationResult, response: purchaseValidationResponse } = await this.inAppPurchases.validate(
      provider,
      receipt
    );

    if (!purchaseValidationResult) {
      ctx.status = 422;
      ctx.body = {
        status: '422',
        title: 'Invalid purchase receipt',
        detail: 'Purchase receipt is not valid',
        meta: purchaseValidationResponse,
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    const merchantInfo: MerchantInfo = {
      id: shortUuid.uuid(),
      name: merchantAttributes['name'],
      slug,
      color: merchantAttributes['color'],
      textColor: merchantAttributes['text-color'],
      ownerAddress: ctx.state.userAddress,
    };

    let db = await this.databaseManager.getClient();
    let merchantInfoId;

    await this.databaseManager.performTransaction(db, async () => {
      merchantInfoId = (await this.merchantInfoQueries.insert(merchantInfo, db)).id;
      await this.cardSpaceQueries.insert({ id: shortUuid.uuid(), merchantId: merchantInfoId } as CardSpace, db);
    });

    let jobTicketId = shortUuid.uuid();
    let jobTicket = {
      id: jobTicketId,
      jobType: 'create-profile',
      ownerAddress: ctx.state.userAddress,
      payload: { 'merchant-info-id': merchantInfoId, 'job-ticket-id': jobTicketId },
      spec: { maxAttempts: 1 },
    };

    let insertedJobTicket = await this.jobTicketsQueries.insert(jobTicket);

    this.workerClient.addJob(
      'create-profile',
      { 'merchant-info-id': merchantInfoId, 'job-ticket-id': jobTicketId },
      { maxAttempts: 1 }
    );

    let serialized = this.merchantInfoSerializer.serialize(merchantInfo);

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
