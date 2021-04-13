import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

let inProgressTimeout: number;
export default class CtaBlockUsage extends Component {
  @tracked stepNumber = 1;
  @tracked canCancel = true;
  @tracked canEdit = false;
  @tracked state = 'memorialized';

  @action changeState(str: string): void {
    console.log(str);
    this.state = str;
    if (str === 'inProgress') {
      inProgressTimeout = window.setTimeout(() => {
        this.changeState('memorialized');
      }, 1500);
    }

    if (str === 'memorialized' || str === 'atRest') {
      window.clearTimeout(inProgressTimeout);
    }
  }
}
