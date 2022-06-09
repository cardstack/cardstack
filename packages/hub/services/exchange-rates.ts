/* global fetch */
import { query } from '../queries';
import config from 'config';
import merge from 'lodash/merge';

export interface CryptoCompareSuccessResponse {
  [currencyCode: string]: CryptoCompareConversionBlock;
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

export interface CryptoCompareConversionBlock {
  [currencyCode: string]: number;
}

export default class ExchangeRatesService {
  exchangeRates = query('exchange-rates', { as: 'exchangeRates' });

  private get apiKey() {
    return config.get('exchangeRates.apiKey') as string;
  }

  /**
   * An example success response from CryptoCompare:
    {
    "USD": {
      "RUB": 58.24,
      "INR": 86.49,
      "NZD": 1.559,
      "ZAR": 15.81
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
    exchange: string
  ): Promise<CryptoCompareSuccessResponse | CryptoCompareFailureResponse> {
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

  private async requestCollectedExchangeRatesFromCryptoCompare(
    from: string,
    tos: string[],
    dateString: string,
    exchange: string
  ): Promise<CryptoCompareSuccessResponse | CryptoCompareFailureResponse> {
    let tosChunks = this.splitTosIntoChunks(tos);

    let results = await Promise.all(
      tosChunks.map((tosChunk) =>
        this.requestExchangeRatesFromCryptoCompare(from, tosChunk.split(','), dateString, exchange)
      )
    );

    let errorResult = results.find((result) => result && result.Response);

    if (errorResult) {
      return errorResult;
    }

    return merge(results[0], ...results.slice(1));
  }

  async fetchExchangeRates(
    from: string,
    tos: string[],
    date: string,
    exchange = 'CCCAGG'
  ): Promise<CryptoCompareSuccessResponse | CryptoCompareFailureResponse | undefined> {
    let cachedValues = await this.exchangeRates.select(from, tos, date, exchange);

    let cachedValuesTos = Object.keys(cachedValues || {});
    let requestedButNotCached = tos.filter((to) => !cachedValuesTos.includes(to));

    if (requestedButNotCached.length === 0) {
      return {
        [from]: cachedValues,
      } as CryptoCompareSuccessResponse;
    }

    let result = await this.requestCollectedExchangeRatesFromCryptoCompare(from, requestedButNotCached, date, exchange);

    if (result) {
      console.debug('CryptoCompare result', JSON.stringify(result, null, 2));

      if (result.Response === 'Error') {
        return result;
      }

      requestedButNotCached.forEach(async (to) => {
        await this.exchangeRates.insert(from, to, (result as CryptoCompareSuccessResponse)[from][to], date, exchange);
      });

      let resultConversions = (result as CryptoCompareSuccessResponse)[from];
      Object.assign(resultConversions, cachedValues);
    } else {
      console.debug('CryptoCompare returned a falsey value');
    }

    return result;
  }

  private splitTosIntoChunks(tos: string[]) {
    // CryptoCompare has a limit of 30 characters for the tsyms parameter so we need to split the request into chunks

    let joinedTos = tos.join(',');
    let tosChunks = [];

    while (joinedTos.length > 30) {
      let indexToCutAt = joinedTos.lastIndexOf(',', 30);
      tosChunks.push(joinedTos.substring(0, indexToCutAt));
      joinedTos = joinedTos.substring(indexToCutAt + 1);
    }

    tosChunks.push(joinedTos);

    return tosChunks;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'exchange-rates': ExchangeRatesService;
  }
}
