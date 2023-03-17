import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import * as Sentry from '@sentry/node';
import { JSONAPIDocument } from '../utils/jsonapi-document';

export const DEGRADED_THRESHOLD = 10;
const STATUS_TIMEOUT = 10 * 1000;

export default class StatusRoute {
  clock = inject('clock');
  exchangeRates = inject('exchange-rates', { as: 'exchangeRates' });
  subgraph = inject('subgraph');
  web3 = inject('web3-http', { as: 'web3' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    let [subgraph, exchangeRates] = await Promise.all([this.getSubgraphStatus(), this.getExchangeRateStatus()]);

    let body: JSONAPIDocument = {
      data: {
        type: 'status',
        attributes: {
          subgraph,
          exchangeRates,
        },
      },
    };

    ctx.status = 200;
    ctx.body = body;
    ctx.type = 'application/vnd.api+json';
  }

  async getSubgraphStatus() {
    let [subgraphBlockNumber, rpcBlockNumber] = await Promise.all([
      this.getSubgraphBlockNumber(),
      this.getRpcBlockNumber(),
    ]);

    let status;
    let details;

    if (rpcBlockNumber && subgraphBlockNumber && rpcBlockNumber - subgraphBlockNumber < DEGRADED_THRESHOLD) {
      status = 'operational';
    } else if (!rpcBlockNumber || !subgraphBlockNumber) {
      details = 'Error checking status';
      status = 'unknown';
    } else {
      details = 'Experiencing slow service';
      status = 'degraded';
    }

    let subgraphStatus = {
      status,
      subgraphBlockNumber,
      rpcBlockNumber,
      details,
    };

    return subgraphStatus;
  }

  async getSubgraphBlockNumber() {
    try {
      let subgraphMeta = await this.withTimeout(this.subgraph.getMeta());
      return subgraphMeta?.data?._meta?.block?.number;
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'status-route',
        },
      });
    }

    return null;
  }

  async getRpcBlockNumber(): Promise<number | null> {
    try {
      let rpcBlockNumber = await this.withTimeout(this.web3.getInstance().eth.getBlockNumber());
      return rpcBlockNumber;
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'status-route',
        },
      });
    }

    return null;
  }

  async getExchangeRateStatus() {
    let exchangeRatesValue = await this.getExchangeRateValue();

    if (exchangeRatesValue && exchangeRatesValue.Response === 'Error') {
      Sentry.captureException(exchangeRatesValue.Message, {
        tags: {
          action: 'status-route',
        },
      });
      exchangeRatesValue = null;
    }

    let status;
    if (exchangeRatesValue) {
      status = 'operational';
    } else {
      status = 'unknown';
    }

    return { status };
  }

  async getExchangeRateValue() {
    try {
      const exchangeRatesValue = await this.withTimeout(
        this.exchangeRates.fetchExchangeRates('USD', ['BTC', 'ETH'], this.clock.dateStringNow())
      );
      return exchangeRatesValue;
    } catch (e) {
      Sentry.captureException(e, {
        tags: {
          action: 'status-route',
        },
      });
    }

    return null;
  }

  async withTimeout(p: Promise<any>): Promise<any> {
    const t = new Promise((resolve) => {
      setTimeout(() => resolve(null), STATUS_TIMEOUT);
    });

    return await Promise.race([t, p]);
  }
}

declare module '@cardstack/hub/routes' {
  interface KnownRoutes {
    status: StatusRoute;
  }
}
