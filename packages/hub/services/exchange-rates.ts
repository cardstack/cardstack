/* global fetch */
import autoBind from 'auto-bind';
import { query } from '../queries';

export interface CryptoCompareSuccessResponse {
  [currencyCode: string]: convertedCurrency;
}

export interface CryptoCompareFailureResponse {
  Response: 'Error';
  Message: string;
  HasWarning: boolean;
  Type: number;
  RateLimit: any;
  Data: any;
  ParamWithError: string;
}

export interface convertedCurrency {
  [currencyCode: string]: number;
}

export default class ExchangeRatesService {
  exchangeRates = query('exchange-rates', { as: 'exchangeRates' });

  constructor() {
    autoBind(this);
  }

  async requestExchangeRatesFromCryptoCompare(
    from: string,
    to: string,
    dateString: string,
    exchange = 'CCCAGG' // FIXME how deep should this optionality go?
  ): Promise<CryptoCompareSuccessResponse | undefined> {
    let timestamp = Date.parse(dateString) / 1000;

    console.debug(
      `fetching https://min-api.cryptocompare.com/data/pricehistorical?fsym=${from}&tsyms=${to}&ts=${timestamp}&e=${exchange}`
    );

    return await (
      await fetch(
        `https://min-api.cryptocompare.com/data/pricehistorical?fsym=${from}&tsyms=${to}&ts=${timestamp}&e=${exchange}`
      )
    ).json();
  }

  async fetchCryptoCompareExchangeRates(
    from: string,
    to: string,
    date: string,
    exchange = 'CCCAGG'
  ): Promise<CryptoCompareSuccessResponse | CryptoCompareFailureResponse | undefined> {
    let cachedValue = await this.exchangeRates.select(from, to, date, exchange);

    if (cachedValue) {
      return {
        [from]: {
          [to]: cachedValue,
        },
      };
    }
    let result = await this.requestExchangeRatesFromCryptoCompare(from, to, date, exchange);

    if (result) {
      console.debug('CryptoCompare result', JSON.stringify(result, null, 2));
      await this.exchangeRates.insert(from, to, result[from][to], date, exchange);
    } else {
      console.debug('CryptoCompare returned a falsey value');
    }

    return result;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'exchange-rates': ExchangeRatesService;
  }
}
