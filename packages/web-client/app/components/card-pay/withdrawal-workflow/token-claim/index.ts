import Component from '@glimmer/component';
import { action } from '@ember/object';
import { reads } from 'macro-decorators';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import BN from 'bn.js';

import {
  BridgeableSymbol,
  BridgedTokenSymbol,
  TokenDisplayInfo,
  getUnbridgedSymbol,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { BridgeValidationResult } from '../../../../../../cardpay-sdk/sdk/token-bridge-home-side';
import { taskFor } from 'ember-concurrency-ts';
import walletProviders, {
  WalletProvider,
} from '@cardstack/web-client/utils/wallet-providers';
import { TransactionHash } from '@cardstack/web-client/utils/web3-strategies/types';

class CardPayWithdrawalWorkflowTokenClaimComponent extends Component<WorkflowCardComponentArgs> {
  walletProviders = walletProviders;
  @service declare layer1Network: Layer1Network;
  @reads('layer1Network.walletProvider') declare walletProvider: WalletProvider;

  get tokenSymbol(): BridgeableSymbol {
    return this.args.workflowSession.getValue('withdrawalToken')!;
  }

  @tracked isConfirming = false;
  get txnHash(): TransactionHash | null {
    return this.args.workflowSession.getValue('txnHash');
  }
  @tracked errorMessage = '';

  get bridgeValidationResult(): BridgeValidationResult {
    let bridgeValidationResult =
      this.args.workflowSession.getValue<BridgeValidationResult>(
        'bridgeValidationResult'
      );
    if (!bridgeValidationResult) {
      throw new Error('missing bridgeValidationResult in workflow session');
    }
    return bridgeValidationResult;
  }

  get withdrawalAmount(): BN {
    return this.args.workflowSession.getValue('withdrawnAmount') ?? new BN('0');
  }

  get tokenSymbolForConversion(): BridgeableSymbol {
    return getUnbridgedSymbol(this.tokenSymbol as BridgedTokenSymbol);
  }

  get tokenDetails(): TokenDisplayInfo<BridgeableSymbol> | undefined {
    if (this.tokenSymbol) {
      return new TokenDisplayInfo(this.tokenSymbol);
    } else {
      return undefined;
    }
  }

  get txViewerUrl() {
    let { txnHash } = this;
    return txnHash && this.layer1Network.blockExplorerUrl(txnHash);
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
  resumeClaimBridgedTokens() {
    if (
      this.txnHash &&
      !this.args.workflowSession.getValue<boolean>('didClaimTokens')
    ) {
      this.claim();
    }
  }

  @action
  async claim() {
    this.errorMessage = '';

    try {
      this.isConfirming = true;
      let { txnHash } = this;
      if (txnHash) {
        await taskFor(this.layer1Network.resumeClaimBridgedTokensTask).perform(
          txnHash
        );
      } else {
        await taskFor(this.layer1Network.claimBridgedTokensTask).perform(
          this.bridgeValidationResult,
          {
            onTxnHash: (txnHash: string) => {
              this.args.workflowSession.setValue('txnHash', txnHash);
            },
          }
        );
      }

      this.args.workflowSession.setValue('didClaimTokens', true);
      this.args.onComplete?.();
    } catch (e: any) {
      console.error(e);
      this.errorMessage = `There was a problem with claiming your tokens. This may be due
      to a network issue, or perhaps you canceled the request in your wallet.`;
    } finally {
      this.isConfirming = false;
    }
  }
}

export default CardPayWithdrawalWorkflowTokenClaimComponent;
