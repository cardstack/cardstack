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
import {
  shouldUseTokenInput,
  validateTokenInput,
} from '@cardstack/web-client/utils/validation';
import { isLayer2UserRejectionError } from '@cardstack/web-client/utils/is-user-rejection-error';
import { taskFor } from 'ember-concurrency-ts';
import { task, TaskGenerator } from 'ember-concurrency';
import { reads } from 'macro-decorators';

class CardPayWithdrawalWorkflowTransactionAmountComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @tracked amount = '';
  @tracked amountIsValid = false;
  @tracked txHash: string | undefined;
  @tracked isConfirmed = false;
  @tracked validationMessage = '';
  @reads('withdrawTask.last.error') declare error: Error | undefined;

  // assumption is this is always set by cards before it. It should be defined by the time
  // it gets to this part of the workflow
  get currentTokenSymbol(): TokenSymbol {
    return this.args.workflowSession.state.withdrawalToken;
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
        this.layer2Network.depotSafe?.address!,
        layer1Address!,
        getUnbridgedSymbol(currentTokenSymbol),
        withdrawnAmount
      );
      let layer2BlockHeight = yield this.layer2Network.getBlockHeight();

      this.txHash = transactionHash;

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
