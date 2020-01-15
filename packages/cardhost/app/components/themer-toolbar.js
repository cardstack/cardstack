import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class ThemerToolbarComponent extends Component {
  @service cssModeToggle;
  @service router;

  @action
  close() {
    this.router.transitionTo('cards.card.view', this.args.model);
  }
}
