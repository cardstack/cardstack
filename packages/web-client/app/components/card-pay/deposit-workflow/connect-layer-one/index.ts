import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency-decorators';
import Layer1Network from '../../../../services/layer1-network';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';

interface CardPayDepositWorkflowConnectLayer1ComponentArgs {
  onComplete: (() => void) | undefined;
}
class CardPayDepositWorkflowConnectLayer1Component extends Component<CardPayDepositWorkflowConnectLayer1ComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @reads('layer1Network.hasAccount') declare hasAccount: boolean;
  @tracked isWaitingForConnection = false;
  @action onClickActionContainerButton() {
    if (!this.hasAccount) {
      taskFor(this.connectWalletTask).perform();
    }
  }
  @task *connectWalletTask() {
    this.isWaitingForConnection = true;
    yield this.layer1Network.waitForAccount;
    this.isWaitingForConnection = false;
    this.args.onComplete?.();
  }
}

export default CardPayDepositWorkflowConnectLayer1Component;
