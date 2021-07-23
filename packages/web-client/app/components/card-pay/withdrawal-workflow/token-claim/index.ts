import Component from '@glimmer/component';
import { action } from '@ember/object';
import { reads } from 'macro-decorators';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import BN from 'web3-core/node_modules/@types/bn.js';
import { toBN } from 'web3-utils';
import {
  BridgedTokenSymbol,
  TokenDisplayInfo,
  TokenSymbol,
  getUnbridgedSymbol,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';

class CardPayWithdrawalWorkflowTokenClaimComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @reads('args.workflowSession.state.withdrawalToken')
  declare tokenSymbol: TokenSymbol;
  @tracked isConfirming = false;
  @tracked txHash: string | undefined;
  @tracked errorMessage = '';

  get withdrawalAmount(): BN {
    if (!this.args.workflowSession.state.withdrawnAmount) {
      return toBN('0');
    }
    return toBN(this.args.workflowSession.state.withdrawnAmount);
  }

  get tokenSymbolForConversion(): TokenSymbol {
    return getUnbridgedSymbol(this.tokenSymbol as BridgedTokenSymbol);
  }

  get tokenDetails(): TokenDisplayInfo | undefined {
    if (this.tokenSymbol) {
      return new TokenDisplayInfo(this.tokenSymbol);
    } else {
      return undefined;
    }
  }

  get txViewerUrl() {
    if (!this.txHash) {
      return '';
    }
    // TODO: get hash
    return this.layer1Network.blockExplorerUrl(this.txHash);
  }

  get ctaState() {
    if (this.args.isComplete) {
      return 'memorialized';
    } else if (this.isConfirming) {
      return 'in-progress';
    } else {
      return 'default';
    }
  }

  get isCtaDisabled() {
    return !this.withdrawalAmount || this.withdrawalAmount.isZero();
  }

  @action
  async claim() {
    this.errorMessage = '';
    if (this.isCtaDisabled) {
      return;
    }
    try {
      this.isConfirming = true;
      // TODO: get confirmation response
      this.args.onComplete?.();
    } catch (e) {
      console.error(e);
      this.errorMessage = `There was a problem with claiming your tokens. This may be due
      to a network issue, or perhaps you canceled the request in your wallet. Please try
      again if you want to continue with this workflow, or contact Cardstack support.`;
    } finally {
      this.isConfirming = false;
    }
  }
}

export default CardPayWithdrawalWorkflowTokenClaimComponent;
