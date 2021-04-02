import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency-decorators';
import Layer2Network from '../../../../services/layer2-network';
import { inject as service } from '@ember/service';
import { waitForProperty } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';

interface CardPayDepositWorkflowConnectMainnetComponentArgs {
  onComplete: (() => void) | undefined;
}
class CardPayDepositWorkflowConnectMainnetComponent extends Component<CardPayDepositWorkflowConnectMainnetComponentArgs> {
  @service declare layer2Network: Layer2Network;
  @reads('layer2Network.hasAccount') declare isConnected: boolean;
  @tracked isWaitingForConnection = false;
  @action onClickActionContainerButton() {
    if (!this.isConnected) {
      taskFor(this.connectWalletTask).perform();
    }
  }
  @task *connectWalletTask() {
    this.isWaitingForConnection = true;
    yield waitForProperty(this, 'isConnected', true);
    this.isWaitingForConnection = false;
    this.args.onComplete?.();
  }
}

export default CardPayDepositWorkflowConnectMainnetComponent;
