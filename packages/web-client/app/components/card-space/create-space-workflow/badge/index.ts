import Component from '@glimmer/component';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { next } from '@ember/runloop';
import config from '@cardstack/web-client/config/environment';

class CreateSpaceWorkflowBadgeComponent extends Component<WorkflowCardComponentArgs> {
  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    next(this, () => {
      this.args.onComplete?.();
    });
  }

  cardSpaceHostnameSuffix = config.cardSpaceHostnameSuffix;

  cardSpaceHostnameSuffixUppercase =
    config.cardSpaceHostnameSuffix.toUpperCase();
}

export default CreateSpaceWorkflowBadgeComponent;
