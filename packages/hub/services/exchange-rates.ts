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
   * Example of a successful request
   * ```
   * {
   *   success: true,
   *   timestamp: 1633018143,
   *   base: 'USD',
   *   date: '2021-09-30',
   *   rates: {
   *     USD: 1,
   *     EUR: 0.859735,
   *     GBP: 0.734635,
   *     AUD: 1.370802,
   *     CNY: 6.4467,
   *     KRW: 1179.593505,
   *     RUB: 72.672501,
   *     INR: 74.264596,
   *     JPY: 111.124504,
   *     TRY: 8.855645,
   *     CAD: 1.2588,
   *     NZD: 1.433345,
   *     ZAR: 14.94734
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
        Sentry.captureException(e);
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
