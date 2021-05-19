import Component from '@glimmer/component';
import Layer1Network from '../../../services/layer1-network';
import Layer2Network from '../../../services/layer2-network';
import { inject as service } from '@ember/service';
import { taskFor } from 'ember-concurrency-ts';
import { task } from 'ember-concurrency-decorators';

interface CardPayLayerConnectModalComponentArgs {
  name: string | null;
  isOpen: boolean;
  onClose: () => void;
}

class CardPayLayerConnectModalComponent extends Component<CardPayLayerConnectModalComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @service declare layer2Network: Layer2Network;
  constructor(owner: unknown, args: CardPayLayerConnectModalComponentArgs) {
    super(owner, args);
    taskFor(this.closeOnConnectedTask).perform();
  }
  @task *closeOnConnectedTask() {
    if (this.args.name === 'layer1') {
      yield this.layer1Network.waitForAccount;
    } else {
      yield this.layer2Network.waitForAccount;
    }
    this.args.onClose();
  }
}

export default CardPayLayerConnectModalComponent;
