import Component from '@glimmer/component';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { action } from '@ember/object';

export const OPTIONS = [
  'Visit this Space',
  'Visit this Business',
  'Visit this Creator',
  'Visit this Person',
];

class CardSpaceEditDetailsButtonTextComponent extends Component<WorkflowCardComponentArgs> {
  options = OPTIONS;

  get buttonTextValue() {
    return this.args.workflowSession.getValue<string>('buttonText');
  }

  @action setButtonTextValue(val: string) {
    this.args.workflowSession.setValue('buttonText', val);
  }
}

export default CardSpaceEditDetailsButtonTextComponent;
