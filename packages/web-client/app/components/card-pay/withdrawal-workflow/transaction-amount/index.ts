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
import {
  shouldUseTokenInput,
  validateTokenInput,
} from '@cardstack/web-client/utils/validation';

class CardPayWithdrawalWorkflowTransactionAmountComponent extends Component<WorkflowCardComponentArgs> {
  @tracked amount = '';
  @tracked amountIsValid = false;
  @tracked isAmountSet = false;
  @tracked errorMessage = '';
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
    return this.isInvalid || this.amount === '';
  }

  get amountAsBigNumber(): BN {
    if (this.isInvalid || this.amount === '') {
      return toBN(0);
    } else {
      return toBN(toWei(this.amount));
    }
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

  @action onInputAmount(amount: string) {
    let trimmed = amount.trim();
    if (shouldUseTokenInput(trimmed)) {
      this.amount = trimmed;
    } else {
      // eslint-disable-next-line no-self-assign
      this.amount = this.amount;
    }

    this.validate();
  }

  get isInvalid() {
    return this.errorMessage !== '';
  }

  validate() {
    this.errorMessage = validateTokenInput(this.amount, {
      min: toBN(0),
      max: this.currentTokenBalance,
    });
  }
}

export default CardPayWithdrawalWorkflowTransactionAmountComponent;
