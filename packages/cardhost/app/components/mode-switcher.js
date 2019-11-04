import Component from '@glimmer/component';
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

  @action
  selectMode(mode) {
    if (!mode || !this.args.name) { return; }

    this.router.transitionTo(`cards.${mode}`, this.args.name);
  }
}
