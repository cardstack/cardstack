import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import * as Sentry from '@sentry/node';

const DEGRADED_THRESHOLD = 10;

export default class StatusRoute {
  subgraph = inject('subgraph');
  web3 = inject('web3-http', { as: 'web3' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let subgraphBlockNumber = null;

    try {
      let subgraphMeta = await this.subgraph.getMeta();
      subgraphBlockNumber = subgraphMeta?.data?._meta?.block?.number;
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'status-route',
        },
      });
    }

    let rpcBlockNumber = null;

    try {
      rpcBlockNumber = await this.web3.getInstance().eth.getBlockNumber();
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'status-route',
        },
      });
    }

    let status = 'degraded';

    if (rpcBlockNumber && subgraphBlockNumber && rpcBlockNumber - subgraphBlockNumber < DEGRADED_THRESHOLD) {
      status = 'healthy';
    }

    ctx.status = 200;
    ctx.body = {
      data: {
        type: 'status',
        attributes: {
          status,
          subgraphBlockNumber,
          rpcBlockNumber,
        },
      },
    };
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'status-route': StatusRoute;
  }
}
