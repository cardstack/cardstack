import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { BigNumber } from '@ethersproject/bignumber';
import { fromWei } from 'web3-utils';

const query =
  'https://min-api.cryptocompare.com/data/pricemulti?fsyms=ETH,CARD,DAI&tsyms=USD&api_key=';

const API_KEY = '';

interface ExchangeRateResponse {
  DAI: { USD: number };
  ETH: { USD: number };
  CARD: { USD: number };
}

class ExchangeRates {
  @tracked lastUpdated: Date | undefined;
  @tracked DAI: number = 0;
  @tracked ETH: number = 0;
  @tracked CARD: number = 0;

  constructor() {
    this.update();
  }

  // update all rates
  async update() {
    try {
      const res: ExchangeRateResponse = await (
        await fetch(query + API_KEY)
      ).json();
      this.DAI = res.DAI.USD;
      this.CARD = res.CARD.USD;
      this.ETH = res.ETH.USD;
      this.lastUpdated = new Date();
    } catch (e) {
      console.error(e);
    }
  }

  getExchangeRate(symbol: 'DAI' | 'ETH' | 'CARD') {
    // TODO: if there's a token rate and we have fetched rates recently just return it
    // otherwise fetch, then return the token rate
    return this[symbol];
  }
}

export default class TokenToUsdService extends Service {
  @tracked exchangeRates = new ExchangeRates();

  etherToUsd(symbol: 'DAI' | 'ETH' | 'CARD', amount: number) {
    const rate = this.exchangeRates.getExchangeRate(symbol);
    return rate! * amount;
  }

  weiToUsd(symbol: 'DAI' | 'ETH' | 'CARD', amountInWei: BigNumber) {
    const amount = fromWei(amountInWei.toHexString());
    // not bothering about precision loss for the rough conversion
    return this.etherToUsd(symbol, +amount);
  }
}
