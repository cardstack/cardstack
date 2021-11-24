import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { inject as service } from '@ember/service';
import BN from 'bn.js';
import { toWei, fromWei } from 'web3-utils';
import {
  BridgedTokenSymbol,
  TokenDisplayInfo,
  TokenSymbol,
  bridgedSymbols,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import {
  TokenInputValidationOptions,
  shouldUseTokenInput,
  validateTokenInput,
} from '@cardstack/web-client/utils/validation';
import { isLayer2UserRejectionError } from '@cardstack/web-client/utils/is-user-rejection-error';
import { Safe } from '@cardstack/cardpay-sdk';
import { taskFor } from 'ember-concurrency-ts';
import { task, TaskGenerator } from 'ember-concurrency';
import { reads } from 'macro-decorators';
import * as Sentry from '@sentry/browser';
import { TransactionReceipt } from 'web3-eth';

class CardPayWithdrawalWorkflowTransactionAmountComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @tracked amount = '';
  @tracked amountIsValid = false;
  @tracked isConfirmed = false;
  @tracked validationMessage = '';
  @reads('withdrawTask.last.error') declare error: Error | undefined;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);

    let withdrawnAmount =
      this.args.workflowSession.getValue<BN>('withdrawnAmount');
    if (withdrawnAmount) {
      this.amount = fromWei(withdrawnAmount);
    }

    if (
      this.txnHash &&
      !this.args.workflowSession.getValue('relayTokensTxnReceipt')
    ) {
      this.withdraw();
    }
  }

  get currentSafe(): Safe {
    return this.layer2Network.safes.getByAddress(
      this.args.workflowSession.getValue<string>('withdrawalSafe')!
    )!;
  }

  get currentTokenSymbol(): BridgedTokenSymbol {
    return this.args.workflowSession.getValue('withdrawalToken')!;
  }

  get currentTokenSymbolWithdrawalLimits() {
    return this.layer2Network.bridgedSymbolToWithdrawalLimits.get(
      this.currentTokenSymbol
    );
  }

  get currentTokenDetails(): TokenDisplayInfo<BridgedTokenSymbol> | undefined {
    if (this.currentTokenSymbol) {
      return new TokenDisplayInfo(this.currentTokenSymbol);
    } else {
      return undefined;
    }
  }

  get currentTokenBalance(): BN {
    let safe = this.currentSafe;
    let balance = safe.tokens.find(
      (token) => token.token.symbol === this.currentTokenSymbol
    )?.balance;

    return balance ? new BN(balance) : new BN(0);
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
    return (
      this.isInvalid ||
      this.amount === '' ||
      this.amountCtaState === 'memorialized'
    );
  }

  get amountAsBigNumber(): BN {
    if (this.isInvalid || this.amount === '') {
      return new BN(0);
    } else {
      return new BN(toWei(this.amount));
    }
  }

  get txnHash() {
    return this.args.workflowSession.getValue<string>('relayTokensTxnHash');
  }

  get txViewerUrl() {
    if (!this.txnHash) {
      return '';
    }

    return this.layer2Network.blockExplorerUrl(this.txnHash);
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
    let limits = this.currentTokenSymbolWithdrawalLimits;
    let validationOptions: TokenInputValidationOptions = {
      balance: this.currentTokenBalance,
      tokenSymbol: this.currentTokenSymbol,
    };

    if (limits) {
      validationOptions.min = limits.min;
      validationOptions.max = limits.max;
    } else {
      Sentry.captureException('Unable to validate withdrawal limits');
    }
    this.validationMessage = validateTokenInput(this.amount, validationOptions);
  }

  @action withdraw() {
    if (this.isAmountCtaDisabled) {
      return;
    }

    taskFor(this.withdrawTask).perform();
  }

  @task *withdrawTask(): TaskGenerator<void> {
    try {
      let layer1Address = this.layer1Network.walletInfo.firstAddress;
      this.isConfirmed = true;
      let { currentTokenSymbol } = this;
      let withdrawnAmount = this.amountAsBigNumber;

      assertBridgedTokenSymbol(currentTokenSymbol);

      this.args.workflowSession.setValue('withdrawnAmount', withdrawnAmount);

      let transactionReceipt: TransactionReceipt;

      if (this.txnHash) {
        transactionReceipt = yield this.layer2Network.resumeBridgeToLayer1(
          this.txnHash
        );
      } else {
        let layer2BlockHeight = yield this.layer2Network.getBlockHeight();
        this.args.workflowSession.setValue(
          'layer2BlockHeightBeforeBridging',
          layer2BlockHeight
        );

        transactionReceipt = yield this.layer2Network.bridgeToLayer1(
          this.currentSafe.address,
          layer1Address!,
          currentTokenSymbol,
          withdrawnAmount.toString(),
          {
            onTxnHash: (txnHash: string) => {
              this.args.workflowSession.setValue('relayTokensTxnHash', txnHash);
            },
          }
        );
      }

      this.args.workflowSession.setValue(
        'relayTokensTxnReceipt',
        transactionReceipt
      );
      this.args.onComplete?.();
    } catch (e) {
      this.isConfirmed = false;

      if (
        e.message.includes(
          'Safe does not have enough balance to transfer tokens'
        )
      ) {
        throw new Error('INSUFFICIENT_FUNDS');
      } else if (isLayer2UserRejectionError(e)) {
        throw new Error('USER_REJECTION');
      } else {
        throw e;
      }
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
