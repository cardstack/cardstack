import Koa from 'koa';
import autoBind from 'auto-bind';
import DatabaseManager from '../services/database-manager';
import { inject } from '../di/dependency-injection';
import shortUuid from 'short-uuid';
import { AuthenticationUtils } from '../utils/authentication';
import MerchantInfoSerializer from '../services/serializers/merchant-info-serializer';

export default class MerchantInfosRoute {
  authenticationUtils: AuthenticationUtils = inject('authentication-utils', { as: 'authenticationUtils' });
  databaseManager: DatabaseManager = inject('database-manager', { as: 'databaseManager' });
  merchantInfoSerializer: MerchantInfoSerializer = inject('merchant-info-serializer', {
    as: 'merchantInfoSerializer',
  });

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

    let newId = shortUuid.uuid();
    let name = ctx.request.body.data.attributes['name'];
    let slug = ctx.request.body.data.attributes['slug']; // TODO: validate uniqueness
    let color = ctx.request.body.data.attributes['color'];
    let textColor = ctx.request.body.data.attributes['text-color'];
    let ownerAddress = ctx.state.userAddress;

    await db.query(
      'INSERT INTO merchant_infos (id, name, slug, color, text_color, owner_address) VALUES($1, $2, $3, $4, $5, $6)',
      [newId, name, slug, color, textColor, ownerAddress]
    );

    let serialized = await this.merchantInfoSerializer.serialize({
      id: newId,
      name,
      slug,
      color,
      textColor,
      ownerAddress,
    });

    ctx.status = 201;
    ctx.body = serialized;
    ctx.type = 'application/vnd.api+json';
  }
}

function ensureLoggedIn(ctx: Koa.Context) {
  if (ctx.state.userAddress) {
    return true;
  }
  ctx.body = {
    errors: [
      {
        status: '401',
        title: 'No valid auth token',
      },
    ],
  };
  ctx.status = 401;
  ctx.type = 'application/vnd.api+json';
  return false;
}

function ensureValidPayload(ctx: Koa.Context) {
  let errors = [errorForAttribute(ctx, 'name'), errorForAttribute(ctx, 'slug'), errorForAttribute(ctx, 'color')].filter(
    Boolean
  );

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

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'merchant-infos-route': MerchantInfosRoute;
  }
}
