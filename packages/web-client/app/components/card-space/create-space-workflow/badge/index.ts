import Component from '@glimmer/component';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { next } from '@ember/runloop';

class CreateSpaceWorkflowBadgeComponent extends Component<WorkflowCardComponentArgs> {
  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    next(this, () => {
      this.args.onComplete?.();
    });
  }
}

export default CreateSpaceWorkflowBadgeComponent;
