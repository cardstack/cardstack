import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CardhostTopEdgeComponent extends Component {
  @service cardstackSession;
  @tracked isExpanded = false;

  @action
  toggleMenuExpand() {
    this.isExpanded = !this.isExpanded;
  }
}
