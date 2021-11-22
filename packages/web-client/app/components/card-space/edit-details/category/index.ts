import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';

export const OPTIONS = [
  'Music',
  'Health',
  'Gaming',
  'Education',
  'Fashion',
  'Writing',
];

class CardSpaceEditDetailsCategoryComponent extends Component<WorkflowCardComponentArgs> {
  @tracked otherValue: string | null = null;

  options = OPTIONS;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);

    if (this.otherIsChecked) {
      this.otherValue = this.categoryValue;
    }
  }

  get categoryValue() {
    return this.args.workflowSession.getValue<string>('category');
  }

  @action setCategoryValue(val: string) {
    this.args.workflowSession.setValue('category', val);
  }

  get otherIsChecked() {
    return this.categoryValue && !OPTIONS.includes(this.categoryValue);
  }

  @action setOtherValue(event: InputEvent) {
    this.otherValue = (event.target! as HTMLInputElement).value;
    this.setCategoryValue(this.otherValue);
  }
}

export default CardSpaceEditDetailsCategoryComponent;
