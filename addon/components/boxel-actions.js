import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class BoxelActions extends Component {
  @service router;
  @tracked format = this.args.format || 'grid';

  @action
  expand() {
    if (this.args.expandRoute && this.args.expandId) {
      this.router.transitionTo(this.args.expandRoute, this.args.expandId, { queryParams: { format: this.format }});
    }
  }
}
