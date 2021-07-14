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
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';

class CardPayWithdrawalWorkflowTransactionAmountComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer2Network: Layer2Network;
  @tracked amount = '';
  @tracked isConfirmed = false;
  @tracked isConfirming = false;
  @tracked isWithdrawing = false;
  @tracked hasWithdrawn = false;
  @tracked errorMessage = '';

  // assumption is this is always set by cards before it. It should be defined by the time
  // it gets to this part of the workflow
  get tokenSymbol(): TokenSymbol {
    return this.args.workflowSession.state.withdrawalToken;
  }

  get tokenSymbolForConversion(): TokenSymbol {
    return getUnbridgedSymbol(this.tokenSymbol as BridgedTokenSymbol);
  }

  get tokenDisplayInfo(): TokenDisplayInfo | undefined {
    if (this.tokenSymbol) {
      return new TokenDisplayInfo(this.tokenSymbol);
    } else {
      return undefined;
    }
  }

  get tokenBalance(): BN {
    let balance;
    if (this.tokenSymbol === 'DAI.CPXD') {
      balance = this.layer2Network.defaultTokenBalance;
    } else if (this.tokenSymbol === 'CARD.CPXD') {
      balance = this.layer2Network.cardBalance;
    }
    return balance || toBN(0);
  }

  get withdrawCtaState() {
    if (this.args.isComplete) {
      return 'memorialized';
    } else if (this.isConfirmed) {
      return 'in-progress';
    } else {
      return 'default';
    }
  }

  get withdrawCtaDisabled() {
    return !this.isConfirmed && !this.isValidAmount;
  }

  get amountAsBN(): BN {
    const regex = /^\d*(\.\d{0,18})?$/gm;
    if (!this.amount || !regex.test(this.amount)) {
      return toBN(0);
    }
    return toBN(toWei(this.amount));
  }

  get isValidAmount() {
    if (!this.amount) return false;
    return (
      !this.amountAsBN.lte(toBN(0)) && this.amountAsBN.lte(this.tokenBalance)
    );
  }

  get txViewerUrl() {
    // TODO
    return '';
  }

  get isConfirmingOrConfirmed() {
    // user has entered the tx amount in the input field and started the withdrawal process
    // once the withdrawal process is started, the input can no longer be changed
    return this.isConfirming || this.isConfirmed;
  }

  @action onInputAmount(str: string) {
    if (!isNaN(+str)) {
      this.amount = str.trim();
    } else {
      this.amount = this.amount; // eslint-disable-line no-self-assign
    }
  }

  @action async confirm() {
    this.errorMessage = '';

    if (this.withdrawCtaDisabled) {
      return;
    }

    try {
      this.isConfirming = true;
      // TODO: confirm action via card wallet
      this.isConfirmed = true;
    } catch (e) {
      console.error(e);
      this.errorMessage =
        'There was a problem receiving confirmation for the withdrawal of your tokens. This may be due to a network issue, or perhaps you canceled the request in your wallet.';
    } finally {
      this.isConfirming = false;
      this.withdraw();
    }
  }

  async withdraw() {
    this.errorMessage = '';

    if (!this.isConfirmed) {
      return;
    }

    try {
      this.isWithdrawing = true;
      // TODO: withdraw action
      this.args.workflowSession.update(
        'withdrawnAmount',
        this.amountAsBN.toString()
      );
      this.args.onComplete?.();
      this.hasWithdrawn = true;
    } catch (e) {
      console.error(e);
      this.errorMessage = `There was a problem initiating the withdrawal of your tokens from ${c.layer2.fullName}. This may be due to a network issue, or perhaps you canceled the request in your wallet.`;
    } finally {
      this.isWithdrawing = false;
    }
  }
}

export default CardPayWithdrawalWorkflowTransactionAmountComponent;
