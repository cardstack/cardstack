import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { BigNumber } from 'ethers';
import TokenToUsdService from '@cardstack/safe-tools-client/services/token-to-usd';
import config from '@cardstack/safe-tools-client/config/environment';
import { taskFor } from 'ember-concurrency-ts';
import nativeUnitsToDecimal from '@cardstack/safe-tools-client/helpers/native-units-to-decimal';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';
import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';

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
      taskFor(this.tokenToUsdService.updateUsdcRate).perform(args.tokenAddress); 
    }, INTERVAL);
  }
  
  get usdcAmount() {
    let token: SelectableToken = {
      address: this.args.tokenAddress,
      name: 'unknown',
      symbol: 'unknown',
      decimals: this.args.tokenDecimals
    };
    let tokenQuantity = new TokenQuantity(token, BigNumber.from(this.args.tokenAmount));
    return this.tokenToUsdService.toUsdc(tokenQuantity);
  }

  willDestroy() {
    clearInterval(this.updateInterval);
  }

  <template>
    {{#if this.usdcAmount}}
      $ {{(nativeUnitsToDecimal this.usdcAmount @tokenDecimals)}} USD
    {{else}}
      Converting to USD...
    {{/if}}
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'token-to-usd': typeof TokenToUsd;
  }
}