import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class ModalUsage extends Component {
  @tracked isOpen = false;
  @tracked overlayClass = '';
  @tracked offsetRight = '0px';
  @tracked offsetLeft = '0px';
  @tracked offsetTop = 'none';
  @tracked maxWidth = '60%';

  @action
  onClose(): void {
    this.isOpen = false;
  }
}
