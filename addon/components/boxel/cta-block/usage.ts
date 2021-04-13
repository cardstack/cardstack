import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class CtaBlockUsage extends Component {
  @tracked stepNumber = 1;
  @tracked canCancel = true;
  @tracked canEdit = false;
  @tracked state = 'done';
  @action changeState(str: string): void {
    console.log(str);
    this.state = str;
    if (str === 'inProgress') {
      setTimeout(() => {
        this.changeState('done');
      }, 1500);
    }
  }
}
