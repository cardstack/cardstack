import Component from '@glimmer/component';
import { next } from '@ember/runloop';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import Layer2Network from '../../../../services/layer2-network';
import { inject as service } from '@ember/service';

export default class CardPayDepositWorkflowConfirmationComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer2Network: Layer2Network;
  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    next(this, () => {
      this.args.onComplete?.();
    });
  }
}
