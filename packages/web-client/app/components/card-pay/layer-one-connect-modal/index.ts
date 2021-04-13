import Component from '@glimmer/component';
import Layer1Network from '../../../services/layer1-network';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { task } from 'ember-concurrency-decorators';

interface CardPayLayerOneConnectModalComponentArgs {
  onClose: () => void;
}

class CardPayLayerOneConnectModalComponent extends Component<CardPayLayerOneConnectModalComponentArgs> {
  @service declare layer1Network: Layer1Network;
  constructor(owner: unknown, args: CardPayLayerOneConnectModalComponentArgs) {
    super(owner, args);
    taskFor(this.closeOnConnectedTask).perform();
  }
  @task *closeOnConnectedTask() {
    yield this.layer1Network.waitForAccount;
    this.args.onClose();
  }
}

export default CardPayLayerOneConnectModalComponent;
