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
      // TODO: get real min dai amount and min card amount
      let MIN_DAI_AMOUNT = new BN(toWei('35'));
      let MIN_CARD_AMOUNT = new BN(toWei('21'));

      if (
        !(
          this.layer2Network.cardBalance?.gte(MIN_CARD_AMOUNT) ||
          this.layer2Network.defaultTokenBalance?.gte(MIN_DAI_AMOUNT)
        )
      ) {
        this.args.cancelWorkflow('INSUFFICIENT_FUNDS');
      }
    });
  }
}
