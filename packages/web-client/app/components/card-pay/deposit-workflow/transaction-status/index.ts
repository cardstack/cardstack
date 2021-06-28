import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import BN from 'bn.js';
import { TransactionReceipt } from 'web3-core';
import { tracked } from '@glimmer/tracking';
import { reads } from 'macro-decorators';
import { TokenSymbol } from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';

class CardPayDepositWorkflowTransactionStatusComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state.depositSourceToken')
  declare selectedTokenSymbol: TokenSymbol;
  @tracked completedCount = 1;
  get layer2BlockHeightBeforeBridging(): BN | undefined {
    return this.args.workflowSession.state.layer2BlockHeightBeforeBridging;
  }
  get progressSteps() {
    return [
      {
        title: 'Deposit tokens into reserve pool on Ethereum mainnet',
      },
      {
        title: 'Bridge tokens from Ethereum mainnet to xDai chain',
      },
      {
        title: `Mint tokens on xDai: ${this.selectedTokenSymbol}.CPXD`,
      },
    ];
  }

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    this.layer2Network
      .awaitBridged(this.layer2BlockHeightBeforeBridging!)
      .then((transactionReceipt: TransactionReceipt) => {
        this.layer2Network.refreshBalances();
        this.args.workflowSession.update(
          'completedLayer2TransactionReceipt',
          transactionReceipt
        );
        this.completedCount = 3;
        this.args.onComplete();
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
      this.args.workflowSession.state.completedLayer2TransactionReceipt
        .transactionHash
    );
  }
}

export default CardPayDepositWorkflowTransactionStatusComponent;
