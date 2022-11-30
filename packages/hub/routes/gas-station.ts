import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import { NotFound } from '@cardstack/core/src/utils/errors';

export default class GasStationRoute {
  gasStationService = inject('gas-station-service', { as: 'gasStationService' });
  gasPriceSerializer = inject('gas-price-serializer', { as: 'gasPriceSerializer' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    try {
      let chainId = Number(ctx.params.chain_id);
      let gasPrice = await this.gasStationService.getGasPriceByChainId(chainId);
      ctx.status = 200;
      ctx.body = this.gasPriceSerializer.serialize(gasPrice);
      ctx.type = 'application/vnd.api+json';
    } catch (error) {
      if (error instanceof NotFound) {
        ctx.status = 404;
        ctx.message = error.message;
      } else {
        ctx.status = 500;
      }
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'gas-station-route': GasStationRoute;
  }
}
