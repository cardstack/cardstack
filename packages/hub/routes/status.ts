import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';

const DEGRADED_THRESHOLD = 10;

export default class StatusRoute {
  subgraph = inject('subgraph');
  web3 = inject('web3-http', { as: 'web3' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let subgraphMeta = await this.subgraph.getMeta();

    let subgraphBlockNumber = subgraphMeta.data._meta.block.number;
    let rpcBlockNumber = await this.web3.getInstance().eth.getBlockNumber();

    let status = rpcBlockNumber - subgraphBlockNumber >= DEGRADED_THRESHOLD ? 'degraded' : 'healthy';

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
