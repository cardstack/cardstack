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
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import {
  shouldUseTokenInput,
  validateTokenInput,
} from '@cardstack/web-client/utils/validation';
import { isLayer2UserRejectionError } from '@cardstack/web-client/utils/is-user-rejection-error';
import { Safe } from '@cardstack/cardpay-sdk/sdk/safes';
import { taskFor } from 'ember-concurrency-ts';
import { task, TaskGenerator } from 'ember-concurrency';
import { reads } from 'macro-decorators';

class CardPayWithdrawalWorkflowTransactionAmountComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @tracked amount = '';
  @tracked amountIsValid = false;
  @tracked txnHash: string | undefined;
  @tracked isConfirmed = false;
  @tracked validationMessage = '';
  @reads('withdrawTask.last.error') declare error: Error | undefined;

  // assumption is these are always set by cards before it. They should be defined by the time
  // it gets to this part of the workflow
  get currentSafe(): Safe {
    return this.args.workflowSession.state.withdrawalSafe;
  }

  get currentTokenSymbol(): BridgedTokenSymbol {
    return this.args.workflowSession.state.withdrawalToken;
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
    let tokenSymbol = this.currentTokenSymbol;
    let unbridgedSymbol = getUnbridgedSymbol(tokenSymbol);
    // SDK returns bridged token symbols without the CPXD suffix

    let balance = safe.tokens.find(
      (token) => token.token.symbol === unbridgedSymbol
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
    this.validationMessage = validateTokenInput(this.amount, {
      min: new BN(0),
      max: this.currentTokenBalance,
    });
  }

  @action withdraw() {
    if (this.isAmountCtaDisabled) {
      return;
    }

    taskFor(this.withdrawTask)
      .perform()
      .catch((e) => {
        console.error(e);
        this.isConfirmed = false;
        if (!this.error) {
          throw new Error('DEFAULT_ERROR');
        }
      });
  }

  @task *withdrawTask(): TaskGenerator<void> {
    try {
      let layer1Address = this.layer1Network.walletInfo.firstAddress;
      this.isConfirmed = true;
      let { currentTokenSymbol } = this;
      let withdrawnAmount = this.amountAsBigNumber.toString();

      assertBridgedTokenSymbol(currentTokenSymbol);

      let transactionHash = yield this.layer2Network.bridgeToLayer1(
        this.currentSafe.address,
        layer1Address!,
        getUnbridgedSymbol(currentTokenSymbol),
        withdrawnAmount
      );
      let layer2BlockHeight = yield this.layer2Network.getBlockHeight();

      this.txnHash = transactionHash;

      this.args.workflowSession.updateMany({
        withdrawnAmount,
        layer2BlockHeightBeforeBridging: layer2BlockHeight,
        relayTokensTxnHash: transactionHash,
      });
      this.args.onComplete?.();
    } catch (e) {
      this.isConfirmed = false;
      if (isLayer2UserRejectionError(e)) {
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
