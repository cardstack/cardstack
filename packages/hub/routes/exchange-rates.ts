import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import config from 'config';
import { CryptoCompareSuccessResponse } from '../services/exchange-rates';

const allowedDomains: string[] = config.get('exchangeRates.allowedDomains');
function isValidAllowedDomainConfig(object: unknown): object is string[] {
  return Array.isArray(object) && object.every((v) => typeof v === 'string') && object.length > 0;
}
if (!isValidAllowedDomainConfig(allowedDomains)) {
  throw new Error('Exchange rate allowed domain config is invalid');
}

/**
 * Provides exchange rate information for converting from USD to other currencies
 */
export default class ExchangeRatesRoute {
  clock = inject('clock');
  exchangeRatesService = inject('exchange-rates', { as: 'exchangeRatesService' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    const hasValidAuthToken = ctx.state.userAddress;
    const isAllowedDomain = ctx.headers.origin && allowedDomains.includes(ctx.headers.origin);
    const isDevelopment = config.get('hubEnvironment') === 'development';

    let from = ctx.query.from as string,
      to = ctx.query.to as string,
      date = ctx.query.date as string;

    if (!from || !to) {
      let missing = [];
      if (!from) missing.push('from');
      if (!to) missing.push('to');

      ctx.status = 400;
      ctx.body = {
        errors: [
          {
            status: '400',
            title: 'Bad Request',
            detail: `Missing required parameter${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
      return;
    }

    if (date) {
      if (Date.parse(date) > this.clock.now()) {
        ctx.status = 400;
        ctx.body = {
          errors: [
            {
              status: '400',
              title: 'Bad Request',
              detail: 'date cannot be in the future',
              pointer: {
                parameter: 'date',
              },
            },
          ],
        };
        ctx.type = 'application/vnd.api+json';
        return;
      }
    } else {
      date = this.clock.dateStringNow();
    }

    let exchange = ctx.query.e as string;

    if (isDevelopment || isAllowedDomain || hasValidAuthToken) {
      let toSymbols = to.split(',');
      let exchangeRates;

      if (exchange) {
        exchangeRates = await this.exchangeRatesService.fetchExchangeRates(from, toSymbols, date, exchange);
      } else {
        exchangeRates = await this.exchangeRatesService.fetchExchangeRates(from, toSymbols, date);
      }

      if (!exchangeRates || exchangeRates.Response) {
        let detail = exchangeRates?.Message
          ? exchangeRates.Message
          : 'Failed to fetch exchange rates for unknown reason';
        ctx.status = 502;
        ctx.body = {
          errors: [
            {
              status: '502',
              title: 'Bad Gateway',
              detail,
            },
          ],
        };
        ctx.type = 'application/vnd.api+json';
      } else {
        ctx.status = 200;
        ctx.body = {
          data: {
            type: 'exchange-rates',
            attributes: {
              base: from,
              rates: (exchangeRates as CryptoCompareSuccessResponse)[from],
            },
          },
        };
        ctx.type = 'application/vnd.api+json';
      }
    } else {
      ctx.status = 403;
      ctx.body = {
        errors: [
          {
            status: '403',
            title: 'Not allowed',
          },
        ],
      };
      ctx.type = 'application/vnd.api+json';
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'exchange-rates-route': ExchangeRatesRoute;
  }
}
