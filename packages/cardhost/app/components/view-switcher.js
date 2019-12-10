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

  @tracked selected = this.views.filterBy('id', this.args.mode).firstObject || this.views[0];

  @action
  selectView(view) {
    this.selected = view;

    if (this.args.cardId) {
      this.router.transitionTo(`cards.${view.id}`, this.args.cardId);
    }
  }
}
