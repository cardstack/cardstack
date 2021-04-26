import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import WorkflowSession from '../../../../models/workflow/workflow-session';
interface CardPayDepositWorkflowTransactionSetupComponentArgs {
  workflowSession: WorkflowSession;
  onComplete: (() => void) | undefined;
  onIncomplete: (() => void) | undefined;
}
class CardPayDepositWorkflowTransactionSetupComponent extends Component<CardPayDepositWorkflowTransactionSetupComponentArgs> {
  @service declare layer1Network: Layer1Network;
  @tracked isShowingLayer1SourceOptions = false;
  @tracked isShowingLayer2TargetOptions = false;

  @action chooseSource(tokenId: string) {
    this.args.workflowSession.update('depositSourceToken', tokenId);
  }
}

export default CardPayDepositWorkflowTransactionSetupComponent;
