import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { toBN } from 'web3-utils';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import {
  ConvertibleSymbol,
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';

class CardPayWithdrawalWorkflowChooseBalanceComponent extends Component<WorkflowCardComponentArgs> {
  defaultTokenSymbol: TokenSymbol = 'DAI.CPXD';
  cardTokenSymbol: TokenSymbol = 'CARD.CPXD';
  @service declare layer2Network: Layer2Network;
  @tracked tokenSymbol: TokenSymbol =
    this.args.workflowSession.state.withdrawalToken ?? this.defaultTokenSymbol;
  @tracked isConfirmed = false;

  get withdrawalToken() {
    return new TokenDisplayInfo(this.tokenSymbol);
  }

  get convertibleSymbol(): ConvertibleSymbol {
    if (this.tokenSymbol === this.cardTokenSymbol) {
      return 'CARD';
    } else {
      return 'DAI';
    }
  }

  get tokenBalance() {
    if (this.tokenSymbol === this.defaultTokenSymbol) {
      return this.layer2Network.defaultTokenBalance ?? toBN('0');
    } else if (this.tokenSymbol === this.cardTokenSymbol) {
      return this.layer2Network.cardBalance ?? toBN('0');
    }
    return toBN('0');
  }

  get withdrawalAmount() {
    // TODO: Replace with the amount selected in previous card
    return this.tokenBalance;
  }

  get depotAddress() {
    return this.layer2Network.depotSafe?.address || undefined;
  }

  get isDisabled() {
    return (
      !this.depotAddress ||
      !this.withdrawalAmount ||
      this.withdrawalAmount.isZero() ||
      this.isConfirmed
    );
  }

  get state() {
    if (this.args.isComplete) {
      return 'memorialized';
    } else if (this.isConfirmed) {
      return 'in-progress';
    } else {
      return 'default';
    }
  }

  @action save() {
    if (this.isDisabled) {
      return;
    }
    // TODO: Need to get confirm action result from Card Wallet
    this.isConfirmed = true; // mock result

    if (this.isConfirmed) {
      this.args.onComplete?.();
    } else {
      this.args.onIncomplete?.();
    }
  }
}

export default CardPayWithdrawalWorkflowChooseBalanceComponent;
