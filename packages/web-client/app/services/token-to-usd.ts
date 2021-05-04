import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { BigNumber } from '@ethersproject/bignumber';
import { fromWei } from 'web3-utils';
class ExchangeRates {
  @tracked lastUpdated: Date | undefined;
  @tracked DAI: number = 1.001;
  @tracked ETH: number = 3482.5;
  @tracked CARD: number = 0.007543;

  constructor() {
    this.update();
  }

  // update all rates
  update() {
    // TODO:
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
