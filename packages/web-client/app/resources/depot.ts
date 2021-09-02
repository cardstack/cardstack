import { Resource } from 'ember-resources';
import { DepotSafe, Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import { Layer2Web3Strategy } from '@cardstack/web-client/utils/web3-strategies/types';
import BN from 'bn.js';
import { taskFor, TaskFunction } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';

interface Args {
  named: {
    strategy: Layer2Web3Strategy;
    walletAddress: string;
  };
}

export class Depot extends Resource<Args> {
  @reads('args.named.strategy.viewSafesTask')
  declare viewSafesTask: TaskFunction;
  @reads('viewSafesTask.isRunning') declare isLoading: boolean;

  constructor(owner: unknown, args: Args) {
    super(owner, args);
    this.fetch();
  }

  async fetch() {
    await taskFor(this.viewSafesTask).perform(this.args.named.walletAddress);
  }

  get value() {
    let safes = taskFor(this.viewSafesTask).lastSuccessful?.value;
    let depotSafes = (safes || []).filter(
      (safe: Safe) => safe.type === 'depot'
    ) as DepotSafe[];

    let depot = depotSafes[depotSafes.length - 1] ?? null;
    return depot;
  }

  get defaultTokenBalance() {
    let { strategy } = this.args.named;
    let defaultBalance = this.value?.tokens.find(
      (tokenInfo) => tokenInfo.token.symbol === strategy.defaultTokenSymbol
    )?.balance;
    return new BN(defaultBalance ?? '0');
  }

  get cardBalance() {
    let cardBalance = this.value?.tokens.find(
      (tokenInfo) => tokenInfo.token.symbol === 'CARD'
    )?.balance;
    return new BN(cardBalance ?? '0');
  }
}
