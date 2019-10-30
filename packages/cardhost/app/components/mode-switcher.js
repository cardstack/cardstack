import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class ModeSwitcher extends Component {
  @service router;
  @tracked name;
  @tracked mode;

  constructor(...args) {
    super(...args);

    this.name = this.args.name;
    this.mode = this.args.mode;
  }

  get mode() {
    return this.mode;
  }

  @action
  selectMode(mode) {
    this.mode = mode;
    this.router.transitionTo(`cards.${this.mode}`, this.name);
  }
}
