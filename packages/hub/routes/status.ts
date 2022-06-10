import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import * as Sentry from '@sentry/node';
import { JSONAPIDocument } from '../utils/jsonapi-document';

export const DEGRADED_THRESHOLD = 10;

export default class StatusRoute {
  clock = inject('clock');
  exchangeRates = inject('exchange-rates', { as: 'exchangeRates' });
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

    let subgraphStatus;
    let subgraphStatusDetails;

    if (rpcBlockNumber && subgraphBlockNumber && rpcBlockNumber - subgraphBlockNumber < DEGRADED_THRESHOLD) {
      subgraphStatus = 'operational';
    } else if (!rpcBlockNumber || !subgraphBlockNumber) {
      subgraphStatusDetails = 'Error checking status';
      subgraphStatus = 'unknown';
    } else {
      subgraphStatusDetails = 'Experiencing slow service';
      subgraphStatus = 'degraded';
    }

    let exchangeRatesValue = null;
    try {
      exchangeRatesValue = await this.exchangeRates.fetchExchangeRates(
        'USD',
        ['BTC', 'ETH'],
        this.clock.dateStringNow()
      );
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'status-route',
        },
      });
    }

    if (exchangeRatesValue && exchangeRatesValue.Response === 'Error') {
      Sentry.captureException(exchangeRatesValue.Message, {
        tags: {
          action: 'status-route',
        },
      });
      exchangeRatesValue = null;
    }

    let exchangeRatesStatus = 'unknown';
    if (exchangeRatesValue) {
      exchangeRatesStatus = 'operational';
    } else if (!exchangeRatesValue) {
      exchangeRatesStatus = 'unknown';
    }

    let body: JSONAPIDocument = {
      data: {
        type: 'status',
        attributes: {
          subgraph: {
            status: subgraphStatus,
            subgraphBlockNumber,
            rpcBlockNumber,
          },
          exchangeRates: {
            status: exchangeRatesStatus,
          },
        },
      },
    };

    if (subgraphStatusDetails) {
      body.data.attributes.subgraph.details = subgraphStatusDetails;
    }

    ctx.status = 200;
    ctx.body = body;
    ctx.type = 'application/vnd.api+json';
  }
}

declare module '@cardstack/hub/routes' {
  interface KnownRoutes {
    status: StatusRoute;
  }
}
