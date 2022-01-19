import Component from '@glimmer/component';
import config from '@cardstack/web-client/config/environment';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';

class CreateSpaceWorkflowNextStepsComponent extends Component<WorkflowCardComponentArgs> {
  get visitSpaceHref() {
    let displayName = this.args.workflowSession.getValue('displayName');
    return `//${displayName}.${config.cardSpaceHostnameSuffix}`;
  }
}

export default CreateSpaceWorkflowNextStepsComponent;
