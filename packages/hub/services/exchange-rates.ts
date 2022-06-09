/* global fetch */
import { query } from '../queries';
import config from 'config';

export interface CryptoCompareSuccessResponse {
  [currencyCode: string]: convertedCurrency;
}

export interface CryptoCompareFailureResponse {
  Response: string;
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

  private get apiKey() {
    return config.get('exchangeRates.apiKey') as string;
  }

  /**
   * An example success response from CryptoCompare:
   * {
      "CARD": {
        "USDT": 0.001964
      }
    }
   *
   * An example error response from CryptoCompare:
   * {
      "Response": "Error",
      "Message": "tsyms param is invalid. (tsyms length is higher than maxlength: 30)",
      "HasWarning": false,
      "Type": 2,
      "RateLimit": {},
      "Data": {},
      "ParamWithError": "tsyms"
      }
   */
  async requestExchangeRatesFromCryptoCompare(
    from: string,
    to: string[],
    dateString: string,
    exchange = 'CCCAGG' // FIXME how deep should this optionality go?
  ): Promise<CryptoCompareSuccessResponse | CryptoCompareFailureResponse | undefined> {
    let timestamp = Date.parse(dateString) / 1000;

    console.debug(
      `fetching https://min-api.cryptocompare.com/data/pricehistorical?fsym=${from}&tsyms=${to.join(
        ','
      )}&ts=${timestamp}&e=${exchange}`
    );

    return await (
      await fetch(
        `https://min-api.cryptocompare.com/data/pricehistorical?fsym=${from}&tsyms=${to.join(
          ','
        )}&ts=${timestamp}&e=${exchange}`,
        {
          headers: {
            authorization: `Apikey ${this.apiKey}`,
          },
        }
      )
    ).json();
  }

  async fetchCryptoCompareExchangeRates(
    from: string,
    to: string[],
    date: string,
    exchange = 'CCCAGG'
  ): Promise<CryptoCompareSuccessResponse | CryptoCompareFailureResponse | undefined> {
    let cachedValues = await this.exchangeRates.select(from, to, date, exchange);

    if (cachedValues) {
      return {
        [from]: cachedValues,
      };
    }
    let result = await this.requestExchangeRatesFromCryptoCompare(from, to, date, exchange);

    if (result) {
      console.debug('CryptoCompare result', JSON.stringify(result, null, 2));

      if (result.Response === 'Error') {
        return result;
      } else {
        await this.exchangeRates.insert(
          from,
          to[0],
          (result as CryptoCompareSuccessResponse)[from][to],
          date,
          exchange
        );
      }
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
