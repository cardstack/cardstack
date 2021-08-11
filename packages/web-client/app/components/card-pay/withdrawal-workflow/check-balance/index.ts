import Component from '@glimmer/component';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow/workflow-card';
import { next } from '@ember/runloop';
import { inject as service } from '@ember/service';
import Layer1Network from '@cardstack/web-client/services/layer1-network';
import {
  TokenDisplayInfo,
  TokenSymbol,
} from '@cardstack/web-client/utils/token';

export default class CardPayWithdrawalWorkflowCheckBalanceComponent extends Component<WorkflowCardComponentArgs> {
  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    next(this, () => {
      this.args.onComplete?.();
    });
  }

  @service declare layer1Network: Layer1Network;

  get header() {
    return `Check ${this.layer1Network.nativeTokenSymbol} balance`;
  }

  get nativeTokenDisplayInfo(): TokenDisplayInfo | undefined {
    return new TokenDisplayInfo(
      this.layer1Network.nativeTokenSymbol as TokenSymbol
    );
  }
}
