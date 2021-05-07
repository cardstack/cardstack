import Component from '@glimmer/component';
import { action } from '@ember/object';
import { equal, and } from 'macro-decorators';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { task } from 'ember-concurrency-decorators';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import WorkflowSession from '../../../../models/workflow/workflow-session';

interface CardPayDepositWorkflowTransactionSetupComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: (() => void) | undefined;
  onIncomplete: (() => void) | undefined;
  isComplete: boolean;
}
interface token {
  symbol: string;
  description: string;
  icon: string;
}
const TOKENS: token[] = [
  {
    symbol: 'DAI',
    description: 'USD-based stablecoin',
    icon: 'dai-token',
  },
  {
    symbol: 'CARD',
    description: 'ERC-20 Cardstack token',
    icon: 'card-token',
  },
];

class CardPayDepositWorkflowTransactionSetupComponent extends Component<CardPayDepositWorkflowTransactionSetupComponentArgs> {
  tokens = TOKENS;
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  @equal('args.workflowSession.state.depositSourceToken', 'CARD')
  cardSelected: Boolean | undefined;
  @equal('args.workflowSession.state.depositSourceToken', 'DAI')
  daiSelected: Boolean | undefined;
  @and('cardSelected', 'layer1Network.cardBalance')
  hasCardBalance: Boolean | undefined;
  @and('daiSelected', 'layer1Network.daiBalance')
  hasDaiBalance: Boolean | undefined;

  constructor(
    owner: unknown,
    args: CardPayDepositWorkflowTransactionSetupComponentArgs
  ) {
    super(owner, args);
    taskFor(this.fetchDepotTask).perform();
  }

  @task *fetchDepotTask(): any {
    let depot = yield this.layer2Network.fetchDepot();
    return depot;
  }

  @action chooseSource(tokenSymbol: string) {
    this.args.workflowSession.update('depositSourceToken', tokenSymbol);
  }

  @action toggleComplete() {
    if (this.args.isComplete) {
      this.args.onIncomplete?.();
    } else if (this.hasCardBalance || this.hasDaiBalance) {
      this.args.onComplete?.();
    } else {
      // TODO error message
    }
  }
}

export default CardPayDepositWorkflowTransactionSetupComponent;
