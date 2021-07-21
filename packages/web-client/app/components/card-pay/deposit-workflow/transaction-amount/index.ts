import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import Layer1Network from '../../../../services/layer1-network';
import Layer2Network from '../../../../services/layer2-network';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { TransactionReceipt } from 'web3-core';
import BN from 'web3-core/node_modules/@types/bn.js';
import { toBN, toWei } from 'web3-utils';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import {
  shouldUseTokenInput,
  validateTokenInput,
} from '@cardstack/web-client/utils/validation';

class CardPayDepositWorkflowTransactionAmountComponent extends Component<WorkflowCardComponentArgs> {
  @tracked amount = '';
  @tracked validationErrorMessage = '';

  @tracked isUnlocked = false;
  @tracked isUnlocking = false;
  @tracked unlockTxnReceipt: TransactionReceipt | undefined;
  @tracked relayTokensTxnReceipt: TransactionReceipt | undefined;
  @tracked depositTxnReceipt: TransactionReceipt | undefined;
  @tracked isDepositing = false;
  @tracked hasDeposited = false;
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @tracked errorMessage = '';

  // assumption is this is always set by cards before it. It should be defined by the time
  // it gets to this part of the workflow
  get currentTokenSymbol(): TokenSymbol {
    return this.args.workflowSession.state.depositSourceToken;
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
    if (this.currentTokenSymbol === 'DAI') {
      balance = this.layer1Network.daiBalance;
    } else if (this.currentTokenSymbol === 'CARD') {
      balance = this.layer1Network.cardBalance;
    }
    return balance || toBN(0);
  }

  get unlockCtaState() {
    if (this.isUnlocked) {
      return 'memorialized';
    } else if (this.isUnlocking) {
      return 'in-progress';
    } else {
      return 'default';
    }
  }
  get unlockCtaDisabled() {
    return !this.isUnlocked && (this.isInvalid || this.amount === '');
  }

  get depositCtaState() {
    if (this.isDepositing) {
      return 'in-progress';
    } else if (this.hasDeposited) {
      return 'memorialized';
    } else {
      return 'default';
    }
  }
  get depositCtaDisabled() {
    return !this.isUnlocked;
  }

  get amountAsBigNumber(): BN {
    if (this.isInvalid || this.amount === '') {
      return toBN(0);
    } else {
      return toBN(toWei(this.amount));
    }
  }

  get unlockTxnViewerUrl() {
    return this.layer1Network.blockExplorerUrl(
      this.unlockTxnReceipt?.transactionHash
    );
  }

  get depositTxnViewerUrl() {
    return this.layer1Network.blockExplorerUrl(
      this.relayTokensTxnReceipt?.transactionHash
    );
  }

  get isUnlockingOrUnlocked() {
    // user has entered the tx amount in the input field and started the unlocking process
    // once the unlocking process is started, the input can no longer be changed
    return this.isUnlocking || this.isUnlocked;
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
    return this.validationErrorMessage !== '';
  }

  validate() {
    this.validationErrorMessage = validateTokenInput(this.amount, {
      min: toBN(0),
      max: this.currentTokenBalance,
    });
  }

  @action async unlock() {
    this.errorMessage = '';

    try {
      this.isUnlocking = true;
      let transactionReceipt = await taskFor(
        this.layer1Network.approve
      ).perform(this.amountAsBigNumber, this.currentTokenSymbol);
      this.isUnlocked = true;
      this.unlockTxnReceipt = transactionReceipt;
    } catch (e) {
      console.error(e);
      this.errorMessage =
        'There was a problem unlocking your tokens for deposit. This may be due to a network issue, or perhaps you canceled the request in your wallet.';
    } finally {
      this.isUnlocking = false;
    }
  }
  @action async deposit() {
    this.errorMessage = '';

    try {
      let layer2Address = this.layer2Network.walletInfo.firstAddress!;
      this.isDepositing = true;
      let layer2BlockHeightBeforeBridging = await this.layer2Network.getBlockHeight();
      this.args.workflowSession.update(
        'layer2BlockHeightBeforeBridging',
        layer2BlockHeightBeforeBridging
      );
      let transactionReceipt = await taskFor(
        this.layer1Network.relayTokens
      ).perform(this.currentTokenSymbol, layer2Address, this.amountAsBigNumber);
      this.relayTokensTxnReceipt = transactionReceipt;
      this.args.workflowSession.update(
        'relayTokensTxnReceipt',
        transactionReceipt
      );
      this.args.workflowSession.update(
        'depositedAmount',
        this.amountAsBigNumber.toString()
      );
      this.args.onComplete?.();
      this.hasDeposited = true;
    } catch (e) {
      console.error(e);
      this.errorMessage = `There was a problem initiating the bridging of your tokens to the ${c.layer2.fullName}. This may be due to a network issue, or perhaps you canceled the request in your wallet.`;
    } finally {
      this.isDepositing = false;
    }
  }
}

export default CardPayDepositWorkflowTransactionAmountComponent;
