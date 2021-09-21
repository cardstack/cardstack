import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import Layer1Network from '../../../../services/layer1-network';
import Layer2Network from '../../../../services/layer2-network';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { TransactionReceipt } from 'web3-core';
import BN from 'bn.js';
import { fromWei, toWei } from 'web3-utils';
import {
  BridgeableSymbol,
  TokenDisplayInfo,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import {
  shouldUseTokenInput,
  validateTokenInput,
} from '@cardstack/web-client/utils/validation';
import { bool, reads } from 'macro-decorators';
import { task, TaskGenerator } from 'ember-concurrency';
import { next } from '@ember/runloop';

class CardPayDepositWorkflowTransactionAmountComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state')
  sessionState: any;
  @reads('sessionState.depositSourceToken')
  declare currentTokenSymbol: BridgeableSymbol;
  @reads('sessionState.unlockTxnHash')
  unlockTxnHash: string | undefined;
  @reads('sessionState.unlockTxnReceipt')
  declare unlockTxnReceipt: TransactionReceipt | undefined;
  @bool('unlockTxnReceipt') declare isUnlocked: boolean;
  @reads('unlockTask.isRunning') declare isUnlocking: boolean;
  @reads('sessionState.relayTokensTxnHash')
  declare relayTokensTxnHash: string | undefined;
  @reads('sessionState.relayTokensTxnReceipt')
  declare relayTokensTxnReceipt: TransactionReceipt | undefined;
  @bool('relayTokensTxnReceipt') declare hasDeposited: boolean;
  @reads('depositTask.isRunning') declare isDepositing: boolean;
  @tracked amount = '';
  @tracked errorMessage = '';
  @tracked validationMessage = '';

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    let { depositedAmount } = this.args.workflowSession.state;

    next(this, () => {
      if (depositedAmount) {
        this.onInputAmount(fromWei(depositedAmount));
      }

      if (this.relayTokensTxnHash && !this.relayTokensTxnReceipt) {
        taskFor(this.depositTask).perform();
      } else if (this.unlockTxnHash && !this.unlockTxnReceipt) {
        taskFor(this.unlockTask).perform();
      }
    });
  }

  get currentTokenDetails(): TokenDisplayInfo<BridgeableSymbol> | undefined {
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
    return balance || new BN(0);
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
      return new BN(0);
    } else {
      return new BN(toWei(this.amount));
    }
  }

  get unlockTxnViewerUrl() {
    return this.layer1Network.blockExplorerUrl(this.unlockTxnHash);
  }

  get depositTxnViewerUrl() {
    return this.layer1Network.blockExplorerUrl(this.relayTokensTxnHash);
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

    this.args.workflowSession.update(
      'depositedAmount',
      this.amountAsBigNumber.toString()
    );
  }

  get isInvalid() {
    return this.validationMessage !== '';
  }

  validate() {
    this.validationMessage = validateTokenInput(this.amount, {
      tokenSymbol: this.currentTokenSymbol,
      balance: this.currentTokenBalance,
    });
  }

  @task *unlockTask(): TaskGenerator<void> {
    this.errorMessage = '';
    let session = this.args.workflowSession;

    try {
      let transactionReceipt;
      if (this.unlockTxnHash) {
        transactionReceipt = yield this.layer1Network.resumeApprove(
          this.unlockTxnHash
        );
      } else {
        transactionReceipt = yield taskFor(
          this.layer1Network.approveTask
        ).perform(
          this.amountAsBigNumber,
          this.currentTokenSymbol,
          (txnHash) => {
            session.update('unlockTxnHash', txnHash);
          }
        );
      }
      session.update('unlockTxnReceipt', transactionReceipt);
    } catch (e) {
      console.error(e);
      this.errorMessage =
        'There was a problem unlocking your tokens for deposit. This may be due to a network issue, or perhaps you canceled the request in your wallet.';
    }
  }

  @task *depositTask(): TaskGenerator<void> {
    this.errorMessage = '';
    let session = this.args.workflowSession;
    try {
      let transactionReceipt;
      if (this.relayTokensTxnHash) {
        transactionReceipt = yield this.layer1Network.resumeRelayTokens(
          this.relayTokensTxnHash
        );
      } else {
        let layer2Address = this.layer2Network.walletInfo.firstAddress!;
        let layer2BlockHeightBeforeBridging =
          yield this.layer2Network.getBlockHeight();
        session.update(
          'layer2BlockHeightBeforeBridging',
          layer2BlockHeightBeforeBridging.toString()
        );
        transactionReceipt = yield taskFor(
          this.layer1Network.relayTokensTask
        ).perform(
          this.currentTokenSymbol,
          layer2Address,
          this.amountAsBigNumber,
          (txnHash) => {
            session.update('relayTokensTxnHash', txnHash);
          }
        );
      }
      session.update('relayTokensTxnReceipt', transactionReceipt);
      session.update('depositedAmount', this.amountAsBigNumber.toString());
      this.args.onComplete?.();
    } catch (e) {
      console.error(e);
      this.errorMessage = `There was a problem initiating the bridging of your tokens to the ${c.layer2.fullName}. This may be due to a network issue, or perhaps you canceled the request in your wallet.`;
    }
  }
}

export default CardPayDepositWorkflowTransactionAmountComponent;
