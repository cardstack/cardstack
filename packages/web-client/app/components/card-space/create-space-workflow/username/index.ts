import Component from '@glimmer/component';
import { action } from '@ember/object';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';

class CreateSpaceUsernameCard extends Component<WorkflowCardComponentArgs> {
  @action save() {
    this.args.workflowSession.setValue('username', 'usernametodo');
    this.args.onComplete?.();
  }
}

export default CreateSpaceUsernameCard;
