import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { BigNumber } from 'ethers';
import TokenToUsdService from '@cardstack/safe-tools-client/services/token-to-usd';
import config from '@cardstack/safe-tools-client/config/environment';
import { taskFor } from 'ember-concurrency-ts';
import weiToDecimal from '@cardstack/safe-tools-client/helpers/wei-to-decimal';
import BoxelLoadingIndicator from '@cardstack/boxel/components/boxel/loading-indicator';
import './index.css';

type Args = {
  tokenAddress: string;
  tokenAmount: BigNumber;
  tokenDecimals: number;
}

interface Signature {
  Element: HTMLElement;
  Args: Args
}

const INTERVAL = config.environment === 'test' ? 1000 : 60 * 1000;

export default class TokenToUsd extends Component<Signature> {
  @service('token-to-usd') declare tokenToUsdService: TokenToUsdService;
  updateInterval: ReturnType<typeof setInterval>;

  constructor(owner: unknown, args: Args) {
    super(owner, args);
    this.updateInterval = setInterval(() => {
      taskFor(this.tokenToUsdService.updateUsdConverter).perform(args.tokenAddress); 
    }, INTERVAL);
  }
  
  get usdAmount() {
    return this.tokenToUsdService.toUsd(this.args.tokenAddress, BigNumber.from(this.args.tokenAmount));
  }

  willDestroy() {
    clearInterval(this.updateInterval);
  }

  <template>
    {{#if this.usdAmount}}
      $ {{(weiToDecimal this.usdAmount @tokenDecimals)}} USD
    {{else}}
      <div class="token-to-usd-loading">
        <BoxelLoadingIndicator class="token-to-usd-loading-indicator" @color="var(--boxel-purple-400)" />
        <div class="network-connect-modal__waiting-status">
          Converting to USD...
        </div>
      </div>
    {{/if}}
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'token-to-usd': typeof TokenToUsd;
  }
}