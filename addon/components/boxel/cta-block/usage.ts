import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class CtaBlockUsage extends Component {
  @tracked stepNumber = 1;
  @tracked canCancel = true;
  @tracked canEdit = true;
  @tracked state = 'inProgress';
  @tracked atRestArgs = {
    text: 'Do it!',
    action: (): void => {
      console.log('doing it');
    },
  };
  @tracked disabledArgs = {
    text: 'I am disabled',
  };
  @tracked inProgressArgs = {
    text: 'Doing it right now',
    cancelText: 'Cancel me',
    cancelAction: (): void => {
      console.log('cancelled');
    },
  };
  @tracked doneArgs = {
    text: 'Done.',
    action: (): void => {
      console.log('Done but going again');
    },
  };
}
