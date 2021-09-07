import Koa from 'koa';
// import Logger from '@cardstack/logger';
import autoBind from 'auto-bind';
import DatabaseManager from '../services/database-manager';
import { inject } from '../di/dependency-injection';
import shortUuid from 'short-uuid';
// let log = Logger('route:prepaid-card-customizations');
import { AuthenticationUtils } from '../utils/authentication';
import WorkerClient from '../services/worker-client';
import PrepaidCardCustomizationSerializer from '../services/serializers/prepaid-card-customization-serializer';
import { ensureLoggedIn } from './utils/auth';

export default class PrepaidCardCustomizationsRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });
  prepaidCardCustomizationSerializer: PrepaidCardCustomizationSerializer = inject(
    'prepaid-card-customization-serializer',
    { as: 'prepaidCardCustomizationSerializer' }
  );
  workerClient: WorkerClient = inject('worker-client', { as: 'workerClient' });

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let db = await this.databaseManager.getClient();

    if (!ensureValidPayload(ctx)) {
      return;
    }

    let issuerName = ctx.request.body.data.attributes['issuer-name'];
    let ownerAddress = ctx.state.userAddress;
    let patternId = ctx.request.body.data.relationships.pattern.data.id;
    let colorSchemeId = ctx.request.body.data.relationships['color-scheme'].data.id;
    let newId = shortUuid.uuid();

    try {
      await db.query(
        'INSERT INTO prepaid_card_customizations (id, owner_address, issuer_name, color_scheme_id, pattern_id) VALUES($1, $2, $3, $4, $5)',
        [newId, ownerAddress, issuerName, colorSchemeId, patternId]
      );
    } catch (e) {
      if (e.constraint.endsWith('fkey')) {
        return foreignKeyConstraintError(ctx, e.constraint);
      } else {
        throw e;
      }
    }
    await this.workerClient.addJob('persist-off-chain-prepaid-card-customization', {
      id: newId,
    });

    let serializedPcc = await this.prepaidCardCustomizationSerializer.serialize(
      {
        id: newId,
        issuerName,
        ownerAddress,
        colorSchemeId,
        patternId,
      },
      {}
    );
    ctx.status = 201;
    ctx.body = serializedPcc;
    ctx.type = 'application/vnd.api+json';
  }
}

function ensureValidPayload(ctx: Koa.Context) {
  let errors = [
    errorForAttribute(ctx, 'issuer-name'),
    errorForRelationship(ctx, 'pattern'),
    errorForRelationship(ctx, 'color-scheme'),
  ].filter(Boolean);
  if (errors.length === 0) {
    return true;
  }
  ctx.body = {
    errors,
  };
  ctx.status = 422;
  ctx.type = 'application/vnd.api+json';
  return false;
}

function errorForAttribute(ctx: Koa.Context, attributeName: string) {
  let attributeValue = ctx.request.body?.data?.attributes?.[attributeName];
  if (attributeValue && attributeValue.length > 0) {
    return;
  }
  return {
    status: '422',
    title: `Missing required attribute: ${attributeName}`,
    detail: `Required field ${attributeName} was not provided`,
  };
}

function errorForRelationship(ctx: Koa.Context, relationshipName: string) {
  let relationshipValue = ctx.request.body?.data?.relationships?.[relationshipName];
  if (!relationshipValue?.data?.id) {
    return {
      status: '422',
      title: `Missing required relationship: ${relationshipName}`,
      detail: `Required relationship ${relationshipName} was not provided`,
    };
  }
  return;
}

function foreignKeyConstraintError(ctx: Koa.Context, constraintName: string) {
  let relationshipName;
  switch (constraintName) {
    case 'prepaid_card_customizations_color_scheme_id_fkey':
      relationshipName = 'color-scheme';
      break;
    case 'prepaid_card_customizations_pattern_id_fkey':
      relationshipName = 'pattern';
      break;
  }
  let error;
  if (relationshipName) {
    let relationshipId = ctx.request.body.data.relationships[relationshipName].data.id;
    error = {
      status: '422',
      title: `Invalid relationship: ${relationshipName}`,
      detail: `Provided ID for ${relationshipName} relationship was not valid: ${relationshipId}`,
    };
    ctx.status = 422;
  } else {
    error = {
      status: '500',
      title: `Database constraint error: ${constraintName}`,
      detail: `A database constraint was violated: ${constraintName}`,
    };
    ctx.status = 500;
  }
  ctx.body = {
    errors: [error],
  };
  ctx.type = 'application/vnd.api+json';
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'prepaid-card-customizations-route': PrepaidCardCustomizationsRoute;
  }
}
