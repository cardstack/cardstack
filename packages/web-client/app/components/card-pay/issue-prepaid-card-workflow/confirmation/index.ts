import Component from '@glimmer/component';
import { next } from '@ember/runloop';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';

export default class CardPayDepositWorkflowConfirmationComponent extends Component<WorkflowCardComponentArgs> {
  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    next(this, () => {
      this.args.onComplete?.();
    });
  }
}
