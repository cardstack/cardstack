import Component from '@glimmer/component';
import { action } from '@ember/object';

export const CARD_EDIT_MODAL_STATES = {
  CLOSED: 'CLOSED',
  EDITING: 'EDITING',
  SUBMITTING: 'SUBMITTING',
} as const;
export default class CardEditComponent extends Component<{
  close: Function;
  save: () => boolean;
  state: string;
  disabled: boolean;
}> {
  get isEditing() {
    return [
      CARD_EDIT_MODAL_STATES.EDITING,
      CARD_EDIT_MODAL_STATES.SUBMITTING,
    ].includes(this.args.state as unknown as any);
  }

  get isSubmitting() {
    return this.args.state === CARD_EDIT_MODAL_STATES.SUBMITTING;
  }

  @action close() {
    if (this.isSubmitting) return;
    this.args.close();
  }

  @action save() {
    if (this.isSubmitting || this.args.disabled) return;
    this.args.save();
  }
}
