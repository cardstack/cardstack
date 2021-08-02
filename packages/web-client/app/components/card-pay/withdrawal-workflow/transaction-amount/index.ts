import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { inject as service } from '@ember/service';
import BN from 'bn.js';
import { toWei } from 'web3-utils';
import {
  BridgedTokenSymbol,
  TokenDisplayInfo,
  TokenSymbol,
  getUnbridgedSymbol,
  bridgedSymbols,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import {
  shouldUseTokenInput,
  validateTokenInput,
} from '@cardstack/web-client/utils/validation';

class CardPayWithdrawalWorkflowTransactionAmountComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @tracked amount = '';
  @tracked amountIsValid = false;
  @tracked txHash: string | undefined;
  @tracked isConfirmed = false;
  @tracked errorMessage = '';
  @tracked validationMessage = '';

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
    return balance || new BN(0);
  }

  get amountCtaState() {
    if (this.args.isComplete) {
      return 'memorialized';
    } else if (this.isConfirmed) {
      return 'in-progress';
    } else {
      return 'default';
    }
  }

  get isAmountCtaDisabled() {
    return this.isInvalid || this.amount === '';
  }

  get amountAsBigNumber(): BN {
    if (this.isInvalid || this.amount === '') {
      return new BN(0);
    } else {
      return new BN(toWei(this.amount));
    }
  }

  get txViewerUrl() {
    if (!this.txHash) {
      return '';
    }
    return this.layer2Network.blockExplorerUrl(this.txHash);
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
    return this.validationMessage !== '';
  }

  validate() {
    this.validationMessage = validateTokenInput(this.amount, {
      min: new BN(0),
      max: this.currentTokenBalance,
    });
  }

  @action async withdraw() {
    this.errorMessage = '';
    if (this.isAmountCtaDisabled) {
      return;
    }
    try {
      let layer1Address = this.layer1Network.walletInfo.firstAddress;
      this.isConfirmed = true;
      let { currentTokenSymbol } = this;
      let withdrawnAmount = this.amountAsBigNumber.toString();

      assertBridgedTokenSymbol(currentTokenSymbol);

      let transactionHash = await this.layer2Network.bridgeToLayer1(
        this.layer2Network.depotSafe?.address!,
        layer1Address!,
        getUnbridgedSymbol(currentTokenSymbol),
        withdrawnAmount
      );
      let layer2BlockHeight = await this.layer2Network.getBlockHeight();

      this.txHash = transactionHash;

      this.args.workflowSession.updateMany({
        withdrawnAmount,
        layer2BlockHeightBeforeBridging: layer2BlockHeight,
        relayTokensTxnHash: transactionHash,
      });
      this.args.onComplete?.();
    } catch (e) {
      console.error(e);
      this.errorMessage = `There was a problem initiating the withdrawal of your tokens from ${c.layer2.fullName}. This may be due to a network issue, or perhaps you canceled the request in your wallet.`;
    }
  }
}

export default CardPayWithdrawalWorkflowTransactionAmountComponent;

function assertBridgedTokenSymbol(
  token: TokenSymbol
): asserts token is BridgedTokenSymbol {
  if (!bridgedSymbols.includes(token as BridgedTokenSymbol)) {
    throw new Error(`${token} is not a bridged token`);
  }
}
