import Component from '@glimmer/component';
import { action } from '@ember/object';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import { next } from '@ember/runloop';

class CardPayWithdrawalWorkflowChooseBalanceComponent extends Component<WorkflowCardComponentArgs> {
  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    next(this, () => {
      this.args.onComplete?.();
    });
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
