import Component from '@glimmer/component';
import { action, set } from '@ember/object';

export default class CardflowStep extends Component {
  @action
  setCompleted() {
    if (this.args.model.completed) { return; }

    set(this.args.model, 'completed', true);

    let nextItem = this.args.actionSteps[this.args.i + 1];
    if (nextItem) {
      set(this.args.model, 'current', false);
      set(nextItem, 'current', true);
    }

    if (this.args.actionSteps.filter(el => el.completed).length === this.args.actionSteps.length) {
      this.args.setProgress(80);
    }
  }
}
