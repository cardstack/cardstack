import { Resource } from 'ember-resources';
import { DepotSafe, Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import { Layer2Web3Strategy } from '@cardstack/web-client/utils/web3-strategies/types';
import { taskFor, TaskFunction } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';
import { BN } from 'bn.js';

interface Args {
  named: {
    strategy: Layer2Web3Strategy;
    walletAddress: string;
  };
}

export class Safes extends Resource<Args> {
  @reads('args.named.strategy.viewSafesTask')
  declare viewSafesTask: TaskFunction;
  @reads('viewSafesTask.lastSuccessful.value', []) declare value: Safe[];
  @reads('viewSafesTask.isRunning') declare isLoading: boolean;

  constructor(owner: unknown, args: Args) {
    super(owner, args);
    this.fetch();
  }

  async fetch() {
    await taskFor(this.viewSafesTask).perform(this.args.named.walletAddress);
  }

  get depot() {
    let safes = this.value;
    let depotSafes = (safes || []).filter(
      (safe: Safe) => safe.type === 'depot'
    ) as DepotSafe[];

    let value = depotSafes[depotSafes.length - 1] ?? null;

    let { strategy } = this.args.named;
    let defaultBalance = value?.tokens.find(
      (tokenInfo) => tokenInfo.token.symbol === strategy.defaultTokenSymbol
    )?.balance;

    let cardBalance = value?.tokens.find(
      (tokenInfo) => tokenInfo.token.symbol === 'CARD'
    )?.balance;

    return {
      value,
      defaultTokenBalance: new BN(defaultBalance ?? '0'),
      cardBalance: new BN(cardBalance ?? '0'),
    };
  }
}
