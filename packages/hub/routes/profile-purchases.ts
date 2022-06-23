import Koa from 'koa';
import autoBind from 'auto-bind';
import { ensureLoggedIn } from './utils/auth';
import { inject } from '@cardstack/di';
import { query } from '@cardstack/hub/queries';
import { CardSpace } from './card-spaces';
import { MerchantInfo } from './merchant-infos';
import shortUuid from 'short-uuid';

export default class ProfilePurchasesRoute {
  databaseManager = inject('database-manager', { as: 'databaseManager' });
  merchantInfoSerializer = inject('merchant-info-serializer', {
    as: 'merchantInfoSerializer',
  });
  merchantInfoQueries = query('merchant-info', {
    as: 'merchantInfoQueries',
  });
  cardSpaceQueries = query('card-space', { as: 'cardSpaceQueries' });

  constructor() {
    autoBind(this);
  }

  async post(ctx: Koa.Context) {
    if (!ensureLoggedIn(ctx)) {
      return;
    }

    let merchantAttributes = ctx.request.body.included[0].attributes;

    const merchantInfo: MerchantInfo = {
      id: shortUuid.uuid(),
      name: merchantAttributes['name'],
      slug: merchantAttributes['slug'],
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

    let serialized = this.merchantInfoSerializer.serialize(merchantInfo);

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
