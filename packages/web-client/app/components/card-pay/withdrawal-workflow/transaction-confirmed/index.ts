import Component from '@glimmer/component';
import { reads } from 'macro-decorators';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import BN from 'bn.js';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import { next } from '@ember/runloop';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';

class CardPayWithdrawalWorkflowTransactionConfirmedComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state.withdrawalToken')
  declare tokenSymbol: TokenSymbol;
  @reads('args.workflowSession.state.relayTokensTxnHash')
  declare relayTokensTxnHash: string;
  @reads('args.workflowSession.state.claimTokensTxnHash')
  declare claimTokensTxnHash: string;

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

  get withdrawAmount(): BN {
    return new BN(this.args.workflowSession.state.withdrawnAmount);
  }

  get bridgeExplorerUrl(): string | undefined {
    return this.layer2Network.bridgeExplorerUrl(this.relayTokensTxnHash);
  }

  get blockscoutUrl(): string {
    return (
      this.args.workflowSession.state.relayTokensTxnHash &&
      this.layer2Network.blockExplorerUrl(this.relayTokensTxnHash)
    );
  }

  get withdrawTxnViewerUrl(): string | undefined {
    return this.layer1Network.blockExplorerUrl(this.claimTokensTxnHash);
  }

  get depotAddress() {
    return this.layer2Network.depotSafe?.address;
  }
}

export default CardPayWithdrawalWorkflowTransactionConfirmedComponent;
