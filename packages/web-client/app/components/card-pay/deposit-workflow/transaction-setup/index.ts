import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

class CardPayDepositWorkflowTransactionSetupComponent extends Component {
  @tracked isShowingLayer1SourceOptions = false;
  @tracked isShowingLayer2TargetOptions = false;
}

export default CardPayDepositWorkflowTransactionSetupComponent;
