import Component from '@glimmer/component';
import { action } from '@ember/object';
import { reads } from 'macro-decorators';
import { inject as service } from '@ember/service';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import WorkflowSession from '../../../../models/workflow/workflow-session';
import { TokenDisplayInfo } from '@cardstack/web-client/utils/token';
import { tracked } from '@glimmer/tracking';
import { faceValueOptions } from '../workflow-config';

interface FaceValueCardArgs {
  workflowSession: WorkflowSession;
  onComplete: (() => void) | undefined;
  onIncomplete: (() => void) | undefined;
  isComplete: boolean;
}

class FaceValueCard extends Component<FaceValueCardArgs> {
  amountOptions = faceValueOptions;
  spendToUSDRate = 0.01;

  @service declare layer2Network: Layer2Network;
  @reads('args.workflowSession.state.prepaidFundingToken')
  declare fundingToken: TokenDisplayInfo;
  @tracked selectedFaceValue: number | undefined;

  @action chooseFaceValue(amount: number) {
    this.selectedFaceValue = amount;
  }

  @action save() {
    this.args.workflowSession.update(
      'prepaidFaceValue',
      this.selectedFaceValue
    );
  }
}

export default FaceValueCard;
