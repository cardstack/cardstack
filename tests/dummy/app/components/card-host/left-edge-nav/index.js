import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import 'dummy/images/media-registry/verifi-logo-dark-outline.svg';

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
