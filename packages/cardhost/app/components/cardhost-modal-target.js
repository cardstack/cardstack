import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CardhostModalTarget extends Component {
  @tracked containerClass = 'cardhost-modal-container';

  @action
  outsideClick(closeFn, evt) {
    if (evt.target === this.containerClass && typeof closeFn === 'function') {
      closeFn();
    }
  }
}
