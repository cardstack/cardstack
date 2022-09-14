import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import './usage.css';
import { type ActionChinState } from './state';
import { type EmptyObject } from '@ember/component/helper';

let inProgressTimeout: number;

interface Signature {
  Element: HTMLDivElement;
  Args: EmptyObject;
  Blocks: EmptyObject;
}

export default class ActionChinUsage extends Component<Signature> {
  @tracked stepNumber = 0;
  @tracked state: ActionChinState = 'default';
  @tracked disabled = false;
  @tracked isComplete = false;
  @tracked unlockState: ActionChinState = 'default';
  @tracked depositState: ActionChinState = 'disabled';

  @tracked paddingHorizontal = 'var(--boxel-sp-lg)';
  @tracked paddingVertical = 'var(--boxel-sp-lg)';
  @tracked backgroundColor = 'var(--boxel-purple-750)';
  @tracked emphasisTextColor = 'var(--boxel-light)';
  @tracked textColor = 'var(--boxel-purple-300)';
  @tracked lockIconSize = '0.75rem';

  get depositIsDisabled(): boolean {
    return (
      this.unlockState !== 'memorialized' || this.depositState === 'disabled'
    );
  }

  @action changeState(str: ActionChinState): void {
    this.unlockState = str;
    if (str === 'in-progress') {
      inProgressTimeout = window.setTimeout(() => {
        this.changeState('memorialized');
        this.depositState = 'default';
      }, 1500);
    }

    if (str === 'memorialized' || str === 'default') {
      window.clearTimeout(inProgressTimeout);
    }
  }

  @action toggleComplete(): void {
    this.isComplete = !this.isComplete;
  }
}
