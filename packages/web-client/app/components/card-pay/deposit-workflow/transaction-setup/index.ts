import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';

class CardPayDepositWorkflowTransactionSetupComponent extends Component {
  @service declare layer1Network: Layer1Network;
  @tracked isShowingLayer1SourceOptions = false;
  @tracked isShowingLayer2TargetOptions = false;
}

export default CardPayDepositWorkflowTransactionSetupComponent;
