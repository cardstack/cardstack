import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import './usage.css';
import { ActionChinState } from './index';
import { EmptyObject } from '@ember/component/helper';

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
