import Component from '@glimmer/component';
import config from '@cardstack/ssr-web/config/environment';
import { WorkflowCardComponentArgs } from '@cardstack/ssr-web/models/workflow';

class CreateSpaceWorkflowNextStepsComponent extends Component<WorkflowCardComponentArgs> {
  get visitSpaceHref() {
    let displayName = this.args.workflowSession.getValue('profileName');
    return `//${displayName}.${config.cardSpaceHostnameSuffix}`;
  }
}

export default CreateSpaceWorkflowNextStepsComponent;
