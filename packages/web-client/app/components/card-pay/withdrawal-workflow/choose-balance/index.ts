import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';

class CardPayWithdrawalWorkflowChooseBalanceComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer2Network: Layer2Network;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
  }

  @action toggleComplete() {
    if (this.args.isComplete) {
      this.args.onIncomplete?.();
    } else {
      this.args.onComplete?.();
    }
  }
}

export default CardPayWithdrawalWorkflowChooseBalanceComponent;
