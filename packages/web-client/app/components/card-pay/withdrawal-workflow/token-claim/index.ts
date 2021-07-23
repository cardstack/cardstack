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
import { BridgeValidationResult } from '../../../../../../cardpay-sdk/sdk/token-bridge-home-side';
import { taskFor } from 'ember-concurrency-ts';
import walletProviders, {
  WalletProvider,
} from '@cardstack/web-client/utils/wallet-providers';

class CardPayWithdrawalWorkflowTokenClaimComponent extends Component<WorkflowCardComponentArgs> {
  walletProviders = walletProviders;
  @service declare layer1Network: Layer1Network;
  @reads('args.workflowSession.state.withdrawalToken')
  declare tokenSymbol: TokenSymbol;
  @tracked isConfirming = false;
  @tracked txHash: string | undefined;
  @tracked errorMessage = '';

  get bridgeValidationResult(): BridgeValidationResult {
    if (!this.args.workflowSession.state.bridgeValidationResult) {
      throw new Error('missing bridgeValidationResult in workflow session');
    }
    return this.args.workflowSession.state
      .bridgeValidationResult as BridgeValidationResult;
  }

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

  get walletProvider(): WalletProvider | undefined {
    return this.walletProviders.find(
      (w) => w.id === this.layer1Network.strategy.currentProviderId
    );
  }

  get txViewerUrl() {
    return this.txHash && this.layer1Network.blockExplorerUrl(this.txHash);
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

  @action
  async claim() {
    this.errorMessage = '';
    try {
      this.isConfirming = true;
      await taskFor(this.layer1Network.claimBridgedTokens).perform(
        this.bridgeValidationResult,
        {
          onTxHash: (txHash: string) => (this.txHash = txHash),
        }
      );
      this.args.workflowSession.update('claimTokensTxnHash', this.txHash);
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
