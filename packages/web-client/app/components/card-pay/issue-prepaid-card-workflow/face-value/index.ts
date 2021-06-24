import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { fromWei, toBN, toWei } from 'web3-utils';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import { faceValueOptions, spendToUsdRate, Token } from '../workflow-config';
import BN from 'web3-core/node_modules/@types/bn.js';

interface FaceValueCardArgs {
  workflowSession: WorkflowSession;
  onComplete: (() => void) | undefined;
  onIncomplete: (() => void) | undefined;
  isComplete: boolean;
}

class FaceValueCard extends Component<FaceValueCardArgs> {
  faceValueOptions = faceValueOptions;
  spendToUsdRate = spendToUsdRate;

  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state.prepaidFundingToken')
  declare fundingToken: Token;
  @tracked selectedFaceValue: number | undefined;

  get selectedValueInBN() {
    if (!this.selectedFaceValue) {
      return toBN('0');
    }
    return toBN(toWei(`${this.selectedFaceValue * spendToUsdRate}`));
  }

  get balanceFromBN() {
    if (!this.fundingToken.balance || this.fundingToken.balance.isZero()) {
      return 0;
    }
    return Number(fromWei(this.fundingToken.balance));
  }

  get isDisabled() {
    if (
      !this.selectedFaceValue ||
      !this.fundingToken.balance ||
      this.fundingToken.balance.isZero()
    ) {
      return true;
    }
    return this.fundingToken.balance.lt(this.selectedValueInBN);
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
