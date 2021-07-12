import Component from '@glimmer/component';
import { reads } from 'macro-decorators';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { toBN } from 'web3-utils';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import { next } from '@ember/runloop';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';
import BN from 'web3-core/node_modules/@types/bn.js';

class CardPayWithdrawalWorkflowChooseBalanceComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state.withdrawalToken')
  declare tokenSymbol: TokenSymbol;

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
    return toBN(this.args.workflowSession.state.withdrawnAmount);
  }

  get withdrawTxnViewerUrl(): string | undefined {
    return this.layer1Network.blockExplorerUrl(
      this.args.workflowSession.state.relayTokensTxnReceipt.transactionHash
    );
  }

  get bridgeExplorerUrl(): string | undefined {
    return this.layer1Network.bridgeExplorerUrl(
      this.args.workflowSession.state.relayTokensTxnReceipt.transactionHash
    );
  }

  get blockscoutUrl(): string {
    return (
      this.args.workflowSession.state.completedLayer2TransactionReceipt &&
      this.layer2Network.blockExplorerUrl(
        this.args.workflowSession.state.completedLayer2TransactionReceipt
          .transactionHash
      )
    );
  }

  get depotAddress() {
    return this.layer2Network.depotSafe?.address;
  }
}

export default CardPayWithdrawalWorkflowChooseBalanceComponent;
