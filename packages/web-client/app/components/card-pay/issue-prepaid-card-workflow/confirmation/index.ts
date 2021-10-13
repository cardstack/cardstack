import Component from '@glimmer/component';
import { next } from '@ember/runloop';
import { inject as service } from '@ember/service';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import Layer2Network from '@cardstack/web-client/services/layer2-network';

export default class CardPayIssuePrepaidCardWorkflowConfirmationComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer2Network: Layer2Network;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    next(this, () => {
      this.args.onComplete?.();
    });
  }

  get prepaidCardSafe() {
    return this.layer2Network.safes.getByAddress(
      this.args.workflowSession.getValue('prepaidCardAddress')!
    );
  }
}
