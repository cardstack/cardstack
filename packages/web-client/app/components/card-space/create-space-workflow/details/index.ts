import Component from '@glimmer/component';
import { action } from '@ember/object';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';

class CreateSpaceWorkflowDetailsComponent extends Component<WorkflowCardComponentArgs> {
  @action save() {
    this.args.onComplete?.();
  }

  @action edit() {
    this.args.onIncomplete?.();
  }

  }
}

export default CreateSpaceWorkflowDetailsComponent;
