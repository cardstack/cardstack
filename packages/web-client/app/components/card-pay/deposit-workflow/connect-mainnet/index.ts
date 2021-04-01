import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

class CardPayDepositWorkflowConnectMainnetComponent extends Component {
  @tracked isWaitingForConnection = false;
  @action onClickActionContainerButton() {
    this.isWaitingForConnection = true;
  }
}

export default CardPayDepositWorkflowConnectMainnetComponent;
