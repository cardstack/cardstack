import Component from '@glimmer/component';
import { reads } from 'macro-decorators';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import WorkflowSession from '../../../../models/workflow/workflow-session';
import { toBN } from 'web3-utils';
import BN from 'bn.js';
import { next } from '@ember/runloop';

interface CardPayDepositWorkflowConfirmationComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: () => void;
}

interface token {
  symbol: string;
  description: string;
  icon: string;
}

const DAI_TOKEN = {
  symbol: 'DAI',
  description: 'USD-based stablecoin',
  icon: 'dai-token',
};
const CARD_TOKEN = {
  symbol: 'CARD',
  description: 'ERC-20 Cardstack token',
  icon: 'card-token',
};

const TOKENS: { [symbol: string]: token } = {
  DAI: DAI_TOKEN,
  CARD: CARD_TOKEN,
};
class CardPayDepositWorkflowConfirmationComponent extends Component<CardPayDepositWorkflowConfirmationComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state.depositSourceToken')
  declare selectedTokenSymbol: string;

  constructor(
    owner: unknown,
    args: CardPayDepositWorkflowConfirmationComponentArgs
  ) {
    super(owner, args);
    next(this, () => {
      this.args.onComplete();
    });
  }

  get depositedToken(): token {
    return TOKENS[this.selectedTokenSymbol] as token;
  }

  get depositedAmount(): BN {
    return toBN(this.args.workflowSession.state.depositedAmount);
  }

  get depositTxnViewerUrl(): string | undefined {
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

  get depotAddress(): string {
    return this.args.workflowSession.state.depotAddress;
  }
}

export default CardPayDepositWorkflowConfirmationComponent;
