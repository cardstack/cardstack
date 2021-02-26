import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class LeftEdgeNav extends Component {
  @service router;

  @action
  transitionToCatalog(route, id) {
    if (route !== 'media-registry.agreements') {
      route = 'media-registry';
    }
    this.router.transitionTo(route, id);
  }
}
