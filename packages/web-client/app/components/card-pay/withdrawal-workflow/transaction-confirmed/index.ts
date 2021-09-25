import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import BN from 'bn.js';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { next } from '@ember/runloop';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';
import { TransactionHash } from '@cardstack/web-client/utils/web3-strategies/types';

class CardPayWithdrawalWorkflowTransactionConfirmedComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  get tokenSymbol(): TokenSymbol {
    return this.args.workflowSession.getValue('withdrawalToken')!;
  }
  get relayTokensTxnHash(): TransactionHash | null {
    return this.args.workflowSession.getValue('relayTokensTxnHash');
  }
  get claimTokensTxnHash(): TransactionHash | null {
    return this.args.workflowSession.getValue('claimTokensTxnHash');
  }

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    next(this, () => {
      this.args.onComplete?.();
    });
  }

  get withdrawToken() {
    return new TokenDisplayInfo(this.tokenSymbol);
  }

  get receivedToken() {
    if (this.tokenSymbol === 'CARD.CPXD') {
      return new TokenDisplayInfo('CARD');
    } else {
      return new TokenDisplayInfo('DAI');
    }
  }

  get withdrawnAmount(): BN {
    return this.args.workflowSession.getValue('withdrawnAmount')!;
  }

  get bridgeExplorerUrl(): string | undefined {
    if (!this.relayTokensTxnHash) return undefined;
    return this.layer2Network.bridgeExplorerUrl(this.relayTokensTxnHash);
  }

  get blockscoutUrl(): string | undefined {
    if (!this.relayTokensTxnHash) return undefined;
    return this.layer2Network.blockExplorerUrl(this.relayTokensTxnHash);
  }

  get withdrawTxnViewerUrl(): string | undefined {
    if (!this.claimTokensTxnHash) return undefined;
    return this.layer1Network.blockExplorerUrl(this.claimTokensTxnHash);
  }

  get depotAddress() {
    return this.layer2Network.depotSafe?.address;
  }
}

export default CardPayWithdrawalWorkflowTransactionConfirmedComponent;
