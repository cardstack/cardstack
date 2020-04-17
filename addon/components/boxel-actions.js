import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class BoxelActions extends Component {
  @service router;

  @action
  expand() {
    if (this.args.expandRoute && this.args.expandId) {
      this.router.transitionTo(this.args.expandRoute, this.args.expandId);
    }
  }
}
