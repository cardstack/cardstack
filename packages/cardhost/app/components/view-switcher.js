import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';

export default class ViewSwitcher extends Component {
  @service cardstackSession;

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

  get mode() {
    if (this.args.mode) {
      return this.views.filterBy('id', this.args.mode).firstObject;
    }

    return this.views[0];
  }

  @action
  selectView(view) {
    this.selected = view;

    if (this.args.card) {
      this.router.transitionTo(`cards.card.${view.id}`, this.args.card.canonicalURL);
    }
  }
}
