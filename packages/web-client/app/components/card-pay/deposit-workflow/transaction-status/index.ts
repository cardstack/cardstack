import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import BN from 'bn.js';
import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import * as Sentry from '@sentry/browser';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { TokenSymbol } from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';

class CardPayDepositWorkflowTransactionStatusComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state.depositSourceToken')
  declare selectedTokenSymbol: TokenSymbol;
  @tracked completedCount = 1;
  @tracked error = false;

  get layer2BlockHeightBeforeBridging(): BN | undefined {
    return this.args.workflowSession.state.layer2BlockHeightBeforeBridging;
  }
  get progressSteps() {
    return [
      {
        title: `Deposit tokens into reserve pool on ${c.layer1.fullName}`,
      },
      {
        title: `Bridge tokens from ${c.layer1.fullName} to ${c.layer2.fullName}`,
      },
      {
        title: `Mint tokens on ${c.layer2.shortName}: ${this.selectedTokenSymbol}.CPXD`,
      },
    ];
  }

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    this.waitForBridgingToComplete();
  }

  async waitForBridgingToComplete() {
    try {
      let transactionReceipt = await this.layer2Network.awaitBridgedToLayer2(
        this.layer2BlockHeightBeforeBridging!
      );
      this.layer2Network.refreshBalances();
      this.args.workflowSession.update(
        'completedLayer2TransactionReceipt',
        transactionReceipt
      );
      this.completedCount = 3;
      this.args.onComplete?.();
    } catch (e) {
      console.error('Failed to complete bridging to layer 2');
      console.error(e);
      Sentry.captureException(e);
      this.error = true;
    }
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
      this.args.workflowSession.state.completedLayer2TransactionReceipt
        .transactionHash
    );
  }
}

export default CardPayDepositWorkflowTransactionStatusComponent;
