import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';

export default class GasStationRoute {
  gasStationService = inject('gas-station-service');

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let chainId: number = ctx.params.chainId;
    let gasPrice = await this.gasStationService.getGasPriceByChainId(chainId);
    if (!gasPrice) {
      ctx.status = 404;
      return;
    }

    ctx.status = 200;
    ctx.body = {
      gasPrice,
    };
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'gas-station-route': GasStationRoute;
  }
}
