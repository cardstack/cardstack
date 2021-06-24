import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { toWei } from 'web3-utils';
import { BN } from 'bn.js';
import Layer2Network from '@cardstack/web-client/services/layer2-network';

interface LayerTwoConnectWrapperComponentArgs {
  cancelWorkflow: (reason: string) => void;
}

export default class LayerTwoConnectWrapperComponent extends Component<LayerTwoConnectWrapperComponentArgs> {
  @service declare layer2Network: Layer2Network;

  constructor(owner: unknown, args: any) {
    super(owner, args);
    this.layer2Network.waitForAccount.then(() => {
      // TODO: get real min dai amount
      let MIN_DAI_AMOUNT = new BN(toWei('50'));

      if (
        !this.layer2Network.defaultTokenBalance ||
        this.layer2Network.defaultTokenBalance?.lt(MIN_DAI_AMOUNT)
      ) {
        this.args.cancelWorkflow('INSUFFICIENT_FUNDS');
      }
    });
  }
}
