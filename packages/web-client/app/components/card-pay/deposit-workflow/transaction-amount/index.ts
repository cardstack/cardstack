import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import Layer1Network from '../../../../services/layer1-network';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';

interface CardPayDepositWorkflowTransactionAmountComponentArgs {
  onComplete: () => void;
}

class CardPayDepositWorkflowTransactionAmountComponent extends Component<CardPayDepositWorkflowTransactionAmountComponentArgs> {
  @tracked amount = 0;
  @tracked isUnlocked = false;
  @service declare layer1Network: Layer1Network;

  get isUnlockButtonDisabled() {
    return this.amount <= 0 || this.isUnlocked;
  }

  get isDepositButtonDisabled() {
    return !this.isUnlocked;
  }

  @action unlock() {
    taskFor(this.layer1Network.unlock)
      .perform()
      .then(() => {
        this.isUnlocked = true;
      });
  }
  @action deposit() {
    taskFor(this.layer1Network.deposit)
      .perform()
      .then(() => {
        this.args.onComplete();
      });
  }
}

export default CardPayDepositWorkflowTransactionAmountComponent;
