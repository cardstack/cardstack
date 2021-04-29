/* eslint-disable ember/no-empty-glimmer-component-classes */
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import { BigNumber } from '@ethersproject/bignumber';

interface CardPayDepositWorkflowTransactionStatusComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
}
class CardPayDepositWorkflowTransactionStatusComponent extends Component<CardPayDepositWorkflowTransactionStatusComponentArgs> {
  @service declare layer1Network: Layer1Network;
  layer2BlockHeightBeforeBridging: BigNumber | undefined;
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
    this.layer2BlockHeightBeforeBridging = this.args.workflowSession.state.layer2BlockHeightBeforeBridging;
    console.log(
      'Start waiting for TokensBridgedForSafe event starting with block',
      this.layer2BlockHeightBeforeBridging
    );
  }

  get completedCount() {
    return 1;
  }

  get depositTxnViewerUrl() {
    return this.layer1Network.txnViewerUrl(
      this.args.workflowSession.state.relayTokensTxnReceipt.transactionHash
    );
  }

  get bridgeExplorerUrl() {
    return this.layer1Network.bridgeExplorerUrl(
      this.args.workflowSession.state.relayTokensTxnReceipt.transactionHash
    );
  }

  get blockscoutUrl() {
    return 'TODO'; // layer 2 blockscout URL for completed bridge transaction
  }
}

export default CardPayDepositWorkflowTransactionStatusComponent;
