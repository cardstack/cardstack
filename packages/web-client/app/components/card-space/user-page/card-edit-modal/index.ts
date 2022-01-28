import Component from '@glimmer/component';
import { action } from '@ember/object';

export default class CardEditComponent extends Component<{
  onClose: Function;
  save: () => boolean;
  isSubmitting: boolean;
  submissionDisabled: boolean;
}> {
  @action close() {
    if (this.args.isSubmitting) return;
    this.args.onClose();
  }

  @action save() {
    if (this.args.isSubmitting || this.args.submissionDisabled) return;
    this.args.save();
  }
}
