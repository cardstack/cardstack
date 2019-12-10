import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';

export default class ViewSwitcher extends Component {
  views = [
    {
      id: 'view',
      name: 'Layout View',
      icon: 'layout',
    },
    {
      id: 'edit',
      name: 'Edit View',
      icon: 'form',
    },
    {
      id: 'schema',
      name: 'Schema View',
      icon: 'schema',
    },
  ];

  @service router;

  @tracked selected = this.views[0];

  optionComponent = 'view-option-component';

  @action
  selectView(view) {
    if (!view || !this.args.name) {
      return;
    }
    this.router.transitionTo(`cards.${view.id}`, this.args.name);
  }
}
