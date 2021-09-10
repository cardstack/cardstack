import Component from '@glimmer/component';
import { next } from '@ember/runloop';
import { inject as service } from '@ember/service';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import Layer2Network from '@cardstack/web-client/services/layer2-network';

export default class CardPayIssuePrepaidCardWorkflowConfirmationComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer2Network: Layer2Network;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    next(this, () => {
      this.layer2Network.refreshSafesAndBalances();
      this.args.onComplete?.();
    });
  }
}
