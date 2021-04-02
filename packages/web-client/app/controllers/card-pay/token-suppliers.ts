import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
class CardPayDepositController extends Controller {
  @service declare layer2Network: Layer2Network;
  @tracked isShowingInstructions = true;

  @action hideInstructions() {
    this.isShowingInstructions = false;
  }
}

export default CardPayDepositController;
