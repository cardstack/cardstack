import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { toWei } from 'web3-utils';
import { BN } from 'bn.js';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';

interface WrappedLayerTwoConnectCardComponentArgs {
  cancelWorkflow: (reason: string) => void;
  onComplete: () => void;
}

// We want to always have the cancelation show after the wallet details are shown.
export default class WrappedLayerTwoConnectCardComponent extends Component<WrappedLayerTwoConnectCardComponentArgs> {
  @service declare layer2Network: Layer2Network;

  // hijack onComplete here, and cancel instead if balance is not sufficient
  // this assumes that layer 2 connection includes fetching of balances
  @action onComplete() {
    let MIN_DAI_AMOUNT = new BN(toWei('50'));

    if (
      !this.layer2Network.defaultTokenBalance ||
      this.layer2Network.defaultTokenBalance?.lt(MIN_DAI_AMOUNT)
    ) {
      this.args.cancelWorkflow('INSUFFICIENT_FUNDS');
    } else {
      this.args.onComplete();
    }
  }
}
