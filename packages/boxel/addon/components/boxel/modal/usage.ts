import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import './usage.css';

export default class ModalUsage extends Component {
  @tracked isOpen = false;
  @tracked overlayClass = '';
  @tracked offsetRight = '0px';
  @tracked offsetLeft = '0px';
  @tracked offsetTop = 'none';
  @tracked maxWidth = '60%';
  @tracked layer = 'default';
  @tracked isDefaultOpen = false;
  @tracked isUrgentOpen = false;

  @action
  onClose(): void {
    this.isOpen = false;
  }

  @action openDefault(): void {
    this.isDefaultOpen = true;
  }

  @action closeDefault(): void {
    this.isDefaultOpen = false;
  }

  @action openUrgent(): void {
    this.isUrgentOpen = true;
  }

  @action closeUrgent(): void {
    this.isUrgentOpen = false;
  }
}
