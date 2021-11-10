import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import './usage.css';

let inProgressTimeout: number;

export default class ActionChinUsage extends Component {
  @tracked stepNumber = 0;
  @tracked state = 'default';
  @tracked disabled = false;
  @tracked isComplete = false;
  @tracked unlockState = 'default';
  @tracked depositState = 'disabled';

  get depositIsDisabled(): boolean {
    return (
      this.unlockState !== 'memorialized' || this.depositState === 'disabled'
    );
  }

  @action changeState(str: string): void {
    console.log(str);
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
