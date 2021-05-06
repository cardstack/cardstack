import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import Layer1Network from '../../../../services/layer1-network';
import Layer2Network from '../../../../services/layer2-network';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import { TransactionReceipt } from 'web3-core';
import { BigNumber } from '@ethersproject/bignumber';
import { parseEther } from '@ethersproject/units';

interface CardPayDepositWorkflowTransactionAmountComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
  isComplete: boolean;
}

interface TokenDisplayDetails {
  name: string;
  description: string;
  symbol: string;
  icon: string;
}

const tokenDetails: {
  [tokenId: string]: TokenDisplayDetails;
} = {
  CARD: {
    name: 'Card',
    symbol: 'CARD',
    description: 'ERC-20 Cardstack token',
    icon: 'card-token',
  },
  DAI: {
    name: 'Dai',
    symbol: 'DAI',
    description: 'USD-based stablecoin',
    icon: 'dai-token',
  },
};

class CardPayDepositWorkflowTransactionAmountComponent extends Component<CardPayDepositWorkflowTransactionAmountComponentArgs> {
  @tracked amount = '0';
  @tracked isUnlocked = false;
  @tracked isUnlocking = false;
  @tracked unlockTxnReceipt: TransactionReceipt | undefined;
  @tracked relayTokensTxnReceipt: TransactionReceipt | undefined;
  @tracked depositTxnReceipt: TransactionReceipt | undefined;
  @tracked isDepositing = false;
  @tracked hasDeposited = false;
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  get currentTokenSymbol(): string | undefined {
    return this.args.workflowSession.state.depositSourceToken;
  }

  get currentTokenDetails(): TokenDisplayDetails | undefined {
    if (tokenDetails[this.currentTokenSymbol!]) {
      return tokenDetails[this.currentTokenSymbol!];
    } else {
      return undefined;
    }
  }

  get currentTokenBalance(): BigNumber {
    let balance;
    if (this.currentTokenSymbol === 'DAI') {
      balance = this.layer1Network.daiBalance;
    } else if (this.currentTokenSymbol === 'CARD') {
      balance = this.layer1Network.cardBalance;
    }
    return balance || BigNumber.from(0);
  }

  get currentTokenBalanceInUsd(): string {
    // TODO: figure out how to get this
    return 'TODO';
  }

  get unlockCtaState() {
    if (this.isUnlocked) {
      return 'memorialized';
    } else if (this.isUnlocking) {
      return 'in-progress';
    } else if (this.isValidAmount) {
      return 'default';
    } else {
      return 'disabled';
    }
  }

  get depositCtaState() {
    if (!this.isUnlocked || (!this.hasDeposited && !this.isValidAmount)) {
      return 'disabled';
    } else if (this.isDepositing) {
      return 'in-progress';
    } else if (this.hasDeposited) {
      return 'memorialized';
    } else {
      return 'default';
    }
  }

  get amountInUsd() {
    // TODO:
    return this.amount;
  }

  get amountAsBigNumber(): BigNumber {
    // parseEther as of @ethersproject/units@5.1.0 uses @ethersproject/bignumber@5.1.0
    // This has problems with `toBigInt`: https://github.com/ethers-io/ethers.js/pull/1485
    // To prevent this, we use BigNumber.from to get an instance of BigNumber from
    // @ethersproject/bignumber@5.1.1 with the fix
    // This may need to change when tokens with precision not equal to 18 are added
    // @ethersproject/units has a utility `parseUnits` that can provide similar functionality
    // and is used by parseEther
    return BigNumber.from(parseEther(this.amount || '0').toHexString());
  }

  get isValidAmount() {
    if (!this.amount) return false;
    return (
      !this.amountAsBigNumber.isZero() &&
      !this.amountAsBigNumber.isNegative() &&
      this.amountAsBigNumber.lte(this.currentTokenBalance)
    );
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

  @action onInputAmount(event: InputEvent) {
    const str = (event.target as HTMLInputElement).value;
    if (!isNaN(+str)) {
      this.amount = str;
    } else {
      this.amount = this.amount; // eslint-disable-line no-self-assign
    }
  }

  @action unlock() {
    let tokenSymbol = this.args.workflowSession.state.depositSourceToken;
    this.isUnlocking = true;
    taskFor(this.layer1Network.approve)
      .perform(this.amountAsBigNumber, tokenSymbol)
      .then((transactionReceipt: TransactionReceipt) => {
        this.isUnlocked = true;
        this.unlockTxnReceipt = transactionReceipt;
      })
      .finally(() => {
        this.isUnlocking = false;
      });
  }
  @action async deposit() {
    let tokenSymbol = this.args.workflowSession.state.depositSourceToken;
    let layer2Address = this.layer2Network.walletInfo.firstAddress!;
    this.isDepositing = true;
    let layer2BlockHeightBeforeBridging = await this.layer2Network.getBlockHeight();
    this.args.workflowSession.update(
      'layer2BlockHeightBeforeBridging',
      layer2BlockHeightBeforeBridging
    );
    taskFor(this.layer1Network.relayTokens)
      .perform(tokenSymbol, layer2Address, this.amountAsBigNumber)
      .then((transactionReceipt: TransactionReceipt) => {
        this.relayTokensTxnReceipt = transactionReceipt;
        this.args.workflowSession.update(
          'relayTokensTxnReceipt',
          transactionReceipt
        );
        this.args.onComplete();
        this.hasDeposited = true;
      })
      .finally(() => {
        this.isDepositing = false;
      });
  }
}

export default CardPayDepositWorkflowTransactionAmountComponent;
