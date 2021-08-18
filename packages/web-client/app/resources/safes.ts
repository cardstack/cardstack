import { Resource } from 'ember-resources';
import { tracked } from '@glimmer/tracking';
import { Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import { Layer2Web3Strategy } from '@cardstack/web-client/utils/web3-strategies/types';

interface Args {
  named: {
    strategy: Layer2Web3Strategy;
    walletAddress: string;
  };
}

export class Safes extends Resource<Args> {
  @tracked value: Safe[] = [];

  constructor(owner: unknown, args: Args) {
    super(owner, args);
    this.fetch();
  }

  async fetch() {
    this.value = await this.args.named.strategy.viewSafes(
      this.args.named.walletAddress
    );
  }
}
