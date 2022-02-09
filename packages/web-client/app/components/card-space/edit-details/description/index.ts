import Component from '@glimmer/component';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CardSpaceEditDetailsDescriptionComponent extends Component<WorkflowCardComponentArgs> {
  @tracked validationMessage = '';
  @tracked description = '';

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    let description =
      this.args.workflowSession.getValue<string>('profileDescription');
    if (description) {
      this.setDescription(description);
    }
  }

  @action setDescription(value: string) {
    this.description = value;
    let validationMessage = this.validateDescription(value);

    if (validationMessage) {
      this.validationMessage = validationMessage;
      this.args.workflowSession.delete('profileDescription');
    } else {
      this.validationMessage = '';
      this.args.workflowSession.setValue('profileDescription', value);
    }
  }

  validateDescription(description: string): string | null {
    if (description && description.length > 0) {
      let maxLength = 100;
      if (description.length > maxLength) {
        return `Maximum length is ${maxLength} characters`;
      } else {
        return null;
      }
    } else {
      return 'Please enter a description';
    }
  }
}
