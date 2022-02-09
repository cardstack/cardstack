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

  get isDisabled() {
    return (
      !this.args.workflowSession.getValue('profileDescription') ||
      !this.args.workflowSession.getValue('profileButtonText') ||
      !this.args.workflowSession.getValue('profileCategory')
    );
  }
}

export default CreateSpaceWorkflowDetailsComponent;
