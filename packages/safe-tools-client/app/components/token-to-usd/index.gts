import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { BigNumber } from 'ethers';
import TokenToUsdService from '@cardstack/safe-tools-client/services/token-to-usd';
import config from '@cardstack/safe-tools-client/config/environment';
import { taskFor } from 'ember-concurrency-ts';

type Args = {
  tokenAddress: string;
  tokenAmount: BigNumber
}

interface Signature {
  Element: HTMLElement;
  Args: Args
}

const INTERVAL = config.environment === 'test' ? 1000 : 60 * 1000;

export default class TokenToUsd extends Component<Signature> {
  @service('token-to-usd') declare tokenToUsdService: TokenToUsdService;
  updateInterval: NodeJS.Timeout;

  constructor(owner: unknown, args: Args) {
    super(owner, args);

    this.updateInterval = setInterval(() => {
      taskFor(this.tokenToUsdService.updateUsdConverter).perform(args.tokenAddress); 
    }, INTERVAL);
  }
  
  get usdAmount() {
    return this.tokenToUsdService.toUsdFrom(this.args.tokenAddress, BigNumber.from(this.args.tokenAmount))?.toString();
  }

  willDestroy() {
    clearInterval(this.updateInterval);
  }

  <template>
    {{this.usdAmount}}
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'token-to-usd': typeof TokenToUsd;
  }
}