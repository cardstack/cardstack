import Component from '@glimmer/component';
import Layer2Network from '../../../services/layer2-network';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { task } from 'ember-concurrency-decorators';

interface CardPayLayerTwoConnectModalComponentArgs {
  onClose: () => void;
}

class CardPayLayerTwoConnectModalComponent extends Component<CardPayLayerTwoConnectModalComponentArgs> {
  @service declare layer2Network: Layer2Network;
  constructor(owner: unknown, args: CardPayLayerTwoConnectModalComponentArgs) {
    super(owner, args);
    taskFor(this.closeOnConnectedTask).perform();
  }
  @task *closeOnConnectedTask() {
    yield this.layer2Network.waitForAccount;
    this.args.onClose();
  }
}

export default CardPayLayerTwoConnectModalComponent;
