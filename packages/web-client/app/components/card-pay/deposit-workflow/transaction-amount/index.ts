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
import { bool, or, reads } from 'macro-decorators';
import {
  didCancel,
  rawTimeout,
  task,
  TaskGenerator,
  TaskInstance,
} from 'ember-concurrency';
import { next } from '@ember/runloop';
import { TransactionHash } from '@cardstack/web-client/utils/web3-strategies/types';
import config from '@cardstack/web-client/config/environment';
import { guidFor } from '@ember/object/internals';
import { formatWeiAmount } from '@cardstack/web-client/helpers/format-wei-amount';
import * as Sentry from '@sentry/ember';

const A_WHILE = config.environment === 'test' ? 500 : 1000 * 10;

class CardPayDepositWorkflowTransactionAmountComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  depositTaskMap: Record<string, TaskInstance<any>> = {};

  get currentTokenSymbol(): BridgeableSymbol {
    return this.args.workflowSession.getValue('depositSourceToken')!;
  }
  get unlockTxnHash(): TransactionHash | null {
    return this.args.workflowSession.getValue('unlockTxnHash')!;
  }
  get unlockTxnReceipt(): TransactionReceipt | null {
    return this.args.workflowSession.getValue('unlockTxnReceipt')!;
  }
  @bool('unlockTxnReceipt') declare isUnlocked: boolean;
  @reads('unlockTask.isRunning') declare isUnlocking: boolean;

  get relayTokensTxnHash(): TransactionHash | null {
    return this.args.workflowSession.getValue('relayTokensTxnHash')!;
  }
  get relayTokensTxnReceipt(): TransactionReceipt | null {
    return this.args.workflowSession.getValue('relayTokensTxnReceipt')!;
  }
  @bool('relayTokensTxnReceipt') declare hasDeposited: boolean;
  @or('newDeposit.isRunning', 'depositTask.isRunning')
  declare isDepositing: boolean;
  @tracked amount = '';
  @tracked errorMessage = '';
  @tracked validationMessage = '';
  @tracked depositTaskRunningForAWhile = false;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    let depositedAmount =
      this.args.workflowSession.getValue<BN>('depositedAmount');

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

  get depositTaskRetryable() {
    return (
      !this.relayTokensTxnHash &&
      this.depositTaskRunningForAWhile &&
      taskFor(this.newDeposit).isRunning
    );
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
    return this.layer1Network.blockExplorerUrl(this.unlockTxnHash!);
  }

  get depositTxnViewerUrl() {
    return this.layer1Network.blockExplorerUrl(this.relayTokensTxnHash!);
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
    return this.validationMessage !== '';
  }

  get tokenInputHelperText() {
    return this.isInvalid
      ? ''
      : `You can deposit up to ${formatWeiAmount(
          this.layer1Network.depositLimits![this.currentTokenSymbol].max
        )} ${this.currentTokenSymbol}`;
  }

  validate() {
    this.validationMessage = validateTokenInput(this.amount, {
      tokenSymbol: this.currentTokenSymbol,
      balance: this.currentTokenBalance,
      min: this.layer1Network.depositLimits![this.currentTokenSymbol].min,
      max: this.layer1Network.depositLimits![this.currentTokenSymbol].max,
    });
  }

  @task *depositTimerTask(): TaskGenerator<void> {
    this.depositTaskRunningForAWhile = false;
    yield rawTimeout(A_WHILE);
    this.depositTaskRunningForAWhile = true;
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
            session.setValue('unlockTxnHash', txnHash);
          }
        );
      }
      session.setValue('unlockTxnReceipt', transactionReceipt);
    } catch (e) {
      session.delete('unlockTxnHash');
      console.error(e);
      Sentry.captureException(e, {
        tags: {
          action: 'deposit/unlock-tokens',
        },
      });
      this.errorMessage =
        'There was a problem unlocking your tokens for deposit. This may be due to a network issue, or perhaps you canceled the request in your wallet.';
    }
  }

  @action retryDeposit() {
    taskFor(this.newDeposit).perform();
  }

  @task *newDeposit(): TaskGenerator<void> {
    let session = this.args.workflowSession;
    try {
      let layer2BlockHeightBeforeBridging =
        yield this.layer2Network.getBlockHeight();
      let layer2Address = this.layer2Network.walletInfo.firstAddress!;
      taskFor(this.depositTimerTask).perform();
      let uid = guidFor({});
      let task = taskFor(this.layer1Network.relayTokensTask).perform(
        this.currentTokenSymbol,
        layer2Address,
        this.amountAsBigNumber,
        (txnHash) => {
          if (this.relayTokensTxnHash) return;
          session.setValue(
            'layer2BlockHeightBeforeBridging',
            layer2BlockHeightBeforeBridging
          );
          session.setValue('relayTokensTxnHash', txnHash);
          this.errorMessage = '';
          this.depositTaskRunningForAWhile = false;
          this.cancelDepositsOtherThan(uid);
        }
      );
      this.depositTaskMap[uid] = task;

      let transactionReceipt = yield task;
      session.setValue('relayTokensTxnReceipt', transactionReceipt);
      this.args.onComplete?.();
    } catch (e) {
      session.delete('relayTokensTxnHash');
      if (didCancel(e)) {
        return;
      }
      Sentry.captureException(e, {
        tags: {
          action: 'deposit/relay-tokens',
        },
      });
      console.error(e);
      this.errorMessage = `There was a problem initiating the bridging of your tokens to the ${c.layer2.fullName}. This may be due to a network issue, or perhaps you canceled the request in your wallet.`;
    }
  }

  cancelDepositsOtherThan(uid: string) {
    for (let key in this.depositTaskMap) {
      if (key !== uid) {
        this.depositTaskMap[key].cancel(
          'Another transaction successfully returned a transaction hash'
        );
        delete this.depositTaskMap[key];
      }
    }
  }

  @task *depositTask(): TaskGenerator<void> {
    this.errorMessage = '';
    let session = this.args.workflowSession;
    try {
      session.setValue('depositedAmount', this.amountAsBigNumber);

      let transactionReceipt;
      if (this.relayTokensTxnHash) {
        transactionReceipt = yield this.layer1Network.resumeRelayTokens(
          this.relayTokensTxnHash
        );
        session.setValue('relayTokensTxnReceipt', transactionReceipt);
        this.args.onComplete?.();
      } else {
        taskFor(this.newDeposit).perform();
      }
    } catch (e) {
      console.error(e);
      Sentry.captureException(e, {
        tags: {
          action: 'deposit/relay-tokens',
        },
      });
      this.errorMessage = `There was a problem initiating the bridging of your tokens to the ${c.layer2.fullName}. This may be due to a network issue, or perhaps you canceled the request in your wallet.`;
    }
  }
}

export default CardPayDepositWorkflowTransactionAmountComponent;
