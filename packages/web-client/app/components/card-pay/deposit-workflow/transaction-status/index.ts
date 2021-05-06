/* eslint-disable ember/no-empty-glimmer-component-classes */
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { BigNumber } from '@ethersproject/bignumber';
import { TransactionReceipt } from 'web3-core';
import { tracked } from '@glimmer/tracking';

interface CardPayDepositWorkflowTransactionStatusComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
}
class CardPayDepositWorkflowTransactionStatusComponent extends Component<CardPayDepositWorkflowTransactionStatusComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @tracked completedCount = 1;
  @tracked completedLayer2TransactionReceipt: TransactionReceipt | undefined;
  get layer2BlockHeightBeforeBridging(): BigNumber | undefined {
    return this.args.workflowSession.state.layer2BlockHeightBeforeBridging;
  }
  progressSteps = [
    {
      title: 'Deposit tokens into Reserve Pool on Ethereum Mainnet',
    },
    {
      title: 'Bridge tokens from Ethereum Mainnet to xDai Chain',
    },
    {
      title: 'Mint tokens on xDai: DAI CPXD',
    },
  ];

  constructor(
    owner: unknown,
    args: CardPayDepositWorkflowTransactionStatusComponentArgs
  ) {
    super(owner, args);
    this.layer2Network
      .awaitBridged(this.layer2BlockHeightBeforeBridging!.toNumber())
      .then((transactionReceipt: TransactionReceipt) => {
        this.completedLayer2TransactionReceipt = transactionReceipt;
        this.completedCount = 3;
      });
  }

  get depositTxnViewerUrl() {
    return this.layer1Network.blockExplorerUrl(
      this.args.workflowSession.state.relayTokensTxnReceipt.transactionHash
    );
  }

  get bridgeExplorerUrl() {
    return this.layer1Network.bridgeExplorerUrl(
      this.args.workflowSession.state.relayTokensTxnReceipt.transactionHash
    );
  }

  get blockscoutUrl() {
    return this.layer2Network.blockExplorerUrl(
      this.completedLayer2TransactionReceipt?.transactionHash
    );
  }
}

export default CardPayDepositWorkflowTransactionStatusComponent;
