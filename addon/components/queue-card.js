import Component from '@glimmer/component';
import { action, set } from '@ember/object';
import { inject as service } from '@ember/service';

export default class QueueCardComponent extends Component {
  @service router;

  @action
  openThread(card) {
    set(card, "status", "open");
    this.router.transitionTo('media-registry.cardflow');
  }
}
