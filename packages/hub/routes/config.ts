import Koa from 'koa';
import autoBind from 'auto-bind';
import { JSONAPIDocument } from '../utils/jsonapi-document';
import config from 'config';

export const DEGRADED_THRESHOLD = 10;

export default class ConfigRoute {
  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let body: JSONAPIDocument = {
      data: {
        type: 'config',
        attributes: {
          web3: {
            network: config.get('web3.network'),
            evmFullNodeUrl: config.get('web3.evmFullNodeUrl'),
          },
        },
      },
    };

    ctx.status = 200;
    ctx.body = body;
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/hub/routes' {
  interface KnownRoutes {
    config: ConfigRoute;
  }
}
