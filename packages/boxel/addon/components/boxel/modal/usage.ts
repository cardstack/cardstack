import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import './usage.css';
import { isBlank } from '@ember/utils';

type ModalSize = 'small' | 'medium' | 'large' | undefined;

export default class ModalUsage extends Component {
  @tracked isOpen = false;
  @tracked size: ModalSize = undefined;
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
    '<undefined>': '65rem',
  };

  @tracked maxWidthOverride: string | undefined;

  get maxWidth(): string | undefined {
    if (isBlank(this.maxWidthOverride)) {
      return this.maxWidths[this.sizeAsString || '<undefined>'];
    } else {
      return this.maxWidthOverride;
    }
  }

  get sizeAsString(): ModalSize | '<undefined>' {
    return this.size ?? '<undefined>';
  }
  @action updateSize(val: ModalSize): void {
    this.size = val;
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
