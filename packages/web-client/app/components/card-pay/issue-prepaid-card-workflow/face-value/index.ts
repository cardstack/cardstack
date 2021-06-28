import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { fromWei, toBN, toWei } from 'web3-utils';
import { faceValueOptions, spendToUsdRate } from '../workflow-config';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';
import BN from 'web3-core/node_modules/@types/bn.js';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';

class FaceValueCard extends Component<WorkflowCardComponentArgs> {
  faceValueOptions = faceValueOptions;
  spendToUsdRate = spendToUsdRate;

  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state.prepaidFundingToken')
  declare fundingTokenSymbol: TokenSymbol;
  @tracked selectedFaceValue?: number;

  get fundingTokenBalance(): BN {
    if (this.fundingTokenSymbol === 'DAI.CPXD') {
      return this.layer2Network.defaultTokenBalance ?? toBN('0');
    }
    return toBN('0');
  }

  get fundingToken() {
    if (this.fundingTokenSymbol) {
      return new TokenDisplayInfo(this.fundingTokenSymbol);
    }
    return undefined;
  }

  get selectedValueInBN() {
    if (!this.selectedFaceValue) {
      return toBN('0');
    }
    return toBN(toWei(`${this.selectedFaceValue * spendToUsdRate}`));
  }

  get balanceFromBN() {
    if (!this.fundingTokenBalance || this.fundingTokenBalance.isZero()) {
      return 0;
    }
    return Number(fromWei(this.fundingTokenBalance));
  }

  get isDisabled() {
    if (
      !this.selectedFaceValue ||
      !this.fundingTokenBalance ||
      this.fundingTokenBalance.isZero()
    ) {
      return true;
    }
    return this.fundingTokenBalance.lt(this.selectedValueInBN);
  }

  @action chooseFaceValue(amount: number) {
    this.selectedFaceValue = amount;
  }

  @action save() {
    if (this.isDisabled) {
      return;
    }
    if (this.selectedFaceValue) {
      this.args.workflowSession.update(
        'spendFaceValue',
        this.selectedFaceValue
      );
    }
    this.args.onComplete?.();
  }
}

export default FaceValueCard;
