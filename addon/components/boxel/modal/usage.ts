import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class ModalUsage extends Component {
  @tracked open = false;
  @tracked overlayClass = '';
  @tracked offsetRight = '0px';
  @tracked offsetLeft = '0px';
  @tracked offsetTop = '30px';
  @tracked maxWidth = '60%';

  @action
  onClose(): void {
    this.open = false;
  }
}
