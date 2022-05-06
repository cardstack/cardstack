import Koa from 'koa';
import autoBind from 'auto-bind';
import { JSONAPIDocument } from '../utils/jsonapi-document';
import config from 'config';

export default class ConfigRoute {
  constructor() {
    autoBind(this);
  }

  get(ctx: Koa.Context) {
    let web3Config = config.get('web3');
    let body: JSONAPIDocument = {
      data: {
        type: 'config',
        attributes: {
          web3: web3Config,
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
