/* eslint-disable ember/no-empty-glimmer-component-classes */
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';

interface CardPayDepositWorkflowTransactionStatusComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
}
class CardPayDepositWorkflowTransactionStatusComponent extends Component<CardPayDepositWorkflowTransactionStatusComponentArgs> {
  @service declare layer1Network: Layer1Network;
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
  get completedCount() {
    return 1;
  }
  get depositTxnViewerUrl() {
    return this.layer1Network.txnViewerUrl(
      this.args.workflowSession.state.depositTxnReceipt.transactionHash
    );
  }
}

export default CardPayDepositWorkflowTransactionStatusComponent;
