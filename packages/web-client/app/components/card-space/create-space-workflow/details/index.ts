import Component from '@glimmer/component';
import { action } from '@ember/object';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { tracked } from '@glimmer/tracking';

class CreateSpaceWorkflowDetailsComponent extends Component<WorkflowCardComponentArgs> {
  detailsModalElement = document.getElementById('create-space-workflow-modal');
  @tracked detailsModalShown: boolean = false;

  @action toggleDetailsForm() {
    if (this.args.isComplete) {
      this.args.onIncomplete?.();
    }
    this.detailsModalShown = !this.detailsModalShown;
  }

  @action onSave() {
    this.detailsModalShown = false;
    this.args.onComplete?.();
  }
}

export default CreateSpaceWorkflowDetailsComponent;
