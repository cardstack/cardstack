import Component from '@glimmer/component';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { action } from '@ember/object';

export const OPTIONS = [
  'Music',
  'Health',
  'Gaming',
  'Education',
  'Fashion',
  'Writing',
];

class CardSpaceEditDetailsCategoryComponent extends Component<WorkflowCardComponentArgs> {
  options = OPTIONS;

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
    this.setCategoryValue((event.target! as HTMLInputElement).value);
  }
}

export default CardSpaceEditDetailsCategoryComponent;
