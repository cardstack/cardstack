import Koa from 'koa';
import autoBind from 'auto-bind';
import { inject } from '@cardstack/di';
import ExchangeRatesService from '../services/exchange-rates';
import config from 'config';

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
  exchangeRatesService: ExchangeRatesService = inject('exchange-rates', { as: 'exchangeRatesService' });

  constructor() {
    autoBind(this);
  }

  async get(ctx: Koa.Context) {
    if (ctx.environment === 'development' || (ctx.headers.origin && allowedDomains.includes(ctx.headers.origin))) {
      let exchangeRates = await this.exchangeRatesService.fetchExchangeRates();
      if (!exchangeRates?.success) {
        let detail = exchangeRates?.error
          ? `${exchangeRates.error.code}: ${exchangeRates.error.info}`
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
              base: exchangeRates.base,
              rates: exchangeRates.rates,
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
