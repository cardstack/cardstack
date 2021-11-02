import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import BN from 'bn.js';
import { next } from '@ember/runloop';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { TransactionReceipt } from 'web3-core';

class CardPayDepositWorkflowConfirmationComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  get selectedTokenSymbol(): TokenSymbol {
    return this.args.workflowSession.getValue('depositSourceToken')!;
  }

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    next(this, () => {
      this.args.onComplete?.();
    });
  }

  get depositedToken() {
    return new TokenDisplayInfo(this.selectedTokenSymbol);
  }

  get depositedAmount(): BN {
    return this.args.workflowSession.getValue('depositedAmount')!;
  }

  get receivedToken() {
    if (this.selectedTokenSymbol === 'CARD') {
      return new TokenDisplayInfo(this.layer2Network.bridgedCardTokenSymbol);
    } else {
      return new TokenDisplayInfo(this.layer2Network.bridgedDaiTokenSymbol);
    }
  }

  get depositTxnViewerUrl(): string | undefined {
    return this.layer1Network.blockExplorerUrl(
      this.args.workflowSession.getValue<TransactionReceipt>(
        'relayTokensTxnReceipt'
      )?.transactionHash
    );
  }

  get bridgeExplorerUrl(): string | undefined {
    return this.layer1Network.bridgeExplorerUrl(
      this.args.workflowSession.getValue<TransactionReceipt>(
        'relayTokensTxnReceipt'
      )!.transactionHash
    );
  }

  get blockscoutUrl(): string {
    let completedLayer2TxnReceipt =
      this.args.workflowSession.getValue<TransactionReceipt>(
        'completedLayer2TxnReceipt'
      );
    if (!completedLayer2TxnReceipt) {
      return '';
    }

    return this.layer2Network.blockExplorerUrl(
      completedLayer2TxnReceipt.transactionHash
    ) as string;
  }

  get depotAddress() {
    return this.layer2Network.depotSafe?.address;
  }
}

export default CardPayDepositWorkflowConfirmationComponent;
