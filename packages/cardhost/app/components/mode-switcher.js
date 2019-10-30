import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

const modes = [
  {
    id: 'view',
    displayTitle: 'Layout View'
  },
  {
    id: 'edit',
    displayTitle: 'Edit View'
  },
  {
    id: 'schema',
    displayTitle: 'Schema View'
  }
];

export default class ModeSwitcher extends Component {
  modes = modes;

  @service router;
  @tracked currentCardName;
  @tracked currentMode;

  constructor(...args) {
    super(...args);

    this.currentCardName = this.args.name;
    this.currentMode = this.args.mode;
  }

  @action
  selectMode(mode) {
    if (!mode || !this.currentCardName) { return; }

    this.currentMode = mode;
    this.router.transitionTo(`cards.${this.currentMode}`, this.currentCardName);
  }
}
