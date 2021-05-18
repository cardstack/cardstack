import Component from '@glimmer/component';
import { action } from '@ember/object';
import { reads } from 'macro-decorators';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { task } from 'ember-concurrency-decorators';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import WorkflowSession from '../../../../models/workflow/workflow-session';
import { toBN } from 'web3-utils';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/web3-strategies/token-display-info';
import { bridgeableSymbols } from '@cardstack/web-client/utils/web3-strategies/token-categories';

interface CardPayDepositWorkflowTransactionSetupComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: (() => void) | undefined;
  onIncomplete: (() => void) | undefined;
  isComplete: boolean;
}

class CardPayDepositWorkflowTransactionSetupComponent extends Component<CardPayDepositWorkflowTransactionSetupComponentArgs> {
  tokens = bridgeableSymbols.map((symbol) => new TokenDisplayInfo(symbol));
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;

  @reads('args.workflowSession.state.depositSourceToken')
  declare selectedTokenSymbol: TokenSymbol;

  constructor(
    owner: unknown,
    args: CardPayDepositWorkflowTransactionSetupComponentArgs
  ) {
    super(owner, args);
    taskFor(this.fetchDepotTask)
      .perform()
      .then((depot: { address: string } | null) => {
        if (depot)
          this.args.workflowSession.update('depotAddress', depot.address);
      });
  }

  get selectedToken() {
    if (
      this.selectedTokenSymbol &&
      TokenDisplayInfo.isRecognizedSymbol(this.selectedTokenSymbol)
    ) {
      return new TokenDisplayInfo(this.selectedTokenSymbol);
    } else {
      return undefined;
    }
  }

  get selectedTokenBalance() {
    if (this.selectedTokenSymbol === 'DAI') {
      return this.layer1Network.daiBalance;
    } else if (this.selectedTokenSymbol === 'CARD') {
      return this.layer1Network.cardBalance;
    } else {
      return toBN(0);
    }
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
    } else if (
      this.selectedTokenSymbol &&
      this.selectedTokenBalance?.gt(toBN(0))
    ) {
      this.args.onComplete?.();
    } else {
      // TODO error message
    }
  }
}

export default CardPayDepositWorkflowTransactionSetupComponent;
