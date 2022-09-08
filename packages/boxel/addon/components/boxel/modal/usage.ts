import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import './usage.css';
import { isBlank } from '@ember/utils';

type SizeVariant = 'small' | 'medium' | 'large' | undefined;

export default class ModalUsage extends Component {
  @tracked isOpen = false;
  @tracked size: SizeVariant;
  @tracked offsetRight = '0px';
  @tracked offsetLeft = '0px';
  @tracked offsetTop = '0px';
  @tracked layer = 'default';
  @tracked isDefaultOpen = false;
  @tracked isUrgentOpen = false;

  maxWidths = {
    small: '36.25rem',
    medium: '43.75rem',
    large: '65rem',
  };

  @tracked maxWidthOverride: string | undefined;

  get maxWidth() {
    if (isBlank(this.maxWidthOverride)) {
      return this.size ? this.maxWidths[this.size] : '65rem';
    } else {
      return this.maxWidthOverride;
    }
  }

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
