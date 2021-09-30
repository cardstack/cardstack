/* global fetch */
import config from 'config';
import supportedNativeCurrencies from '@cardstack/cardpay-sdk/sdk/native-currencies';
import * as Sentry from '@sentry/node';

const currencySymbols = Object.keys(supportedNativeCurrencies);
const INTERVAL = 1000 * 60 * 60;

// these results are from fixer.
export interface FixerSuccessResponse {
  success: true;
  timestamp: number;
  base: string;
  date: string;
  rates: {
    [currencyCode: string]: number;
  };
}

export interface FixerFailureResponse {
  success: false;
  error: {
    code: number;
    info: string;
  };
}

export default class ExchangeRatesService {
  interval: number = INTERVAL;
  lastFetched = 0;
  cachedValue: FixerSuccessResponse | undefined = undefined;

  private get apiKey() {
    return config.get('exchangeRates.apiKey') as string;
  }

  /**
   * Sample response
   * ```
   * {
   *   success: true,
   *   timestamp: 1633018143,
   *   base: 'USD',
   *   date: '2021-09-30',
   *   rates: {
   *     EUR: 1,
   *     GBP: 0.860246,
   *     AUD: 1.602961,
   *     CNY: 7.463258,
   *     KRW: 1370.453432,
   *     RUB: 84.171385,
   *     INR: 85.915208,
   *     JPY: 129.027569,
   *     TRY: 10.291685,
   *     CAD: 1.468866,
   *     NZD: 1.679484,
   *     ZAR: 17.450637
   *   }
   * }
   * ```
   *
   * Example of a failed request:
   * ```
   * {
   *   "success": false,
   *   "error": {
   *     "code": 104,
   *     "info": "Your monthly API request volume has been reached. Please upgrade your plan."
   *   }
   * }
   * ```
   */
  async fetchExchangeRates(): Promise<FixerSuccessResponse | FixerFailureResponse | undefined> {
    if (this.cacheIsValid) {
      return this.cachedValue;
    } else {
      try {
        // this approach has a risk of sending multiple requests when the cache is invalidated
        // since it does not handle simultaneous requests
        let result = await this.requestExchangeRatesFromFixer();
        if (result?.success) {
          this.cachedValue = result;
          this.lastFetched = result.timestamp * 1000;
        } else {
          Sentry.captureException(result ?? 'Fetching exchange rates returned a falsey value');
          this.invalidateCache();
        }
        return result;
      } catch (e) {
        Sentry.captureException(e ?? 'Fetching exchange rates returned a falsey value');
        this.invalidateCache();
        throw e;
      }
    }
  }

  invalidateCache() {
    this.cachedValue = undefined;
    this.lastFetched = 0;
  }

  async requestExchangeRatesFromFixer(): Promise<FixerSuccessResponse | FixerFailureResponse | undefined> {
    return await (
      await fetch(`http://data.fixer.io/api/latest?access_key=${this.apiKey}&base=USD&symbols=${currencySymbols}`)
    ).json();
  }

  get cacheIsValid() {
    return Boolean(Number(new Date()) - this.lastFetched <= this.interval && this.cachedValue);
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'exchange-rates': ExchangeRatesService;
  }
}
