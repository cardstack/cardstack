import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

class Thread {
  @tracked milestones = [
    {
      message: '',
      complete: false,
      statusOnCompletion: 'TBD',
      messageOnCompletion: 'TBD',
    },
  ];
  @tracked progress = 0;
  @tracked displayCompletionMessage = false;
}

class CardPayDepositController extends Controller {
  @service declare layer2Network: Layer2Network;
  @tracked isShowingInstructions = true;

  @action hideInstructions() {
    this.isShowingInstructions = false;
  }

  @tracked thread = new Thread();
}

export default CardPayDepositController;
