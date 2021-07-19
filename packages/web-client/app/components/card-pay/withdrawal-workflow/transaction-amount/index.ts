import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { inject as service } from '@ember/service';
import BN from 'web3-core/node_modules/@types/bn.js';
import { toBN, toWei } from 'web3-utils';
import {
  BridgedTokenSymbol,
  TokenDisplayInfo,
  TokenSymbol,
  getUnbridgedSymbol,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';

class CardPayWithdrawalWorkflowTransactionAmountComponent extends Component<WorkflowCardComponentArgs> {
  @tracked amount = '';
  @tracked amountIsValid = false;
  @tracked isAmountSet = false;
  @service declare layer2Network: Layer2Network;

  // assumption is this is always set by cards before it. It should be defined by the time
  // it gets to this part of the workflow
  get currentTokenSymbol(): TokenSymbol {
    return this.args.workflowSession.state.withdrawalToken;
  }

  get tokenSymbolForConversion(): TokenSymbol {
    return getUnbridgedSymbol(this.currentTokenSymbol as BridgedTokenSymbol);
  }

  get currentTokenDetails(): TokenDisplayInfo | undefined {
    if (this.currentTokenSymbol) {
      return new TokenDisplayInfo(this.currentTokenSymbol);
    } else {
      return undefined;
    }
  }

  get currentTokenBalance(): BN {
    let balance;
    if (this.currentTokenSymbol === 'DAI.CPXD') {
      balance = this.layer2Network.defaultTokenBalance;
    } else if (this.currentTokenSymbol === 'CARD.CPXD') {
      balance = this.layer2Network.cardBalance;
    }
    return balance || toBN(0);
  }

  get setAmountCtaState() {
    if (this.isAmountSet) {
      return 'memorialized';
    } else {
      return 'default';
    }
  }

  get setAmountCtaDisabled() {
    return !this.amountIsValid;
  }

  get amountAsBigNumber(): BN {
    if (this.amountIsValid) {
      return toBN(toWei(this.amount));
    } else {
      return toBN(0);
    }
  }

  @action onInputAmount(str: string, isValid: boolean) {
    this.amount = str;
    this.amountIsValid = isValid;
  }

  @action toggleAmountSet() {
    if (this.isAmountSet) {
      this.isAmountSet = false;
      this.args.onIncomplete?.();
    } else {
      this.args.workflowSession.update(
        'withdrawnAmount',
        this.amountAsBigNumber.toString()
      );
      this.args.onComplete?.();
      this.isAmountSet = true;
    }
  }
}

export default CardPayWithdrawalWorkflowTransactionAmountComponent;
