import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

interface ModalPageWrapperArguments {
  back: Function;
}

export default class ModalPageWrapper extends Component {
  widthMediaQuery?: MediaQueryList;
  @tracked showPage = false;

  constructor(owner: unknown, args: ModalPageWrapperArguments) {
    super(owner, args);
    if (window.matchMedia) {
      this.widthMediaQuery = window?.matchMedia?.('(max-width: 480px)');
      this.updateDisplay(this.widthMediaQuery);
      this.widthMediaQuery.addEventListener('change', this.updateDisplay);
    }
  }

  @action updateDisplay(
    eventOrQueryObject: MediaQueryListEvent | MediaQueryList
  ) {
    this.showPage = eventOrQueryObject.matches;
  }

  willDestroy() {
    super.willDestroy();
    this.widthMediaQuery?.removeEventListener('change', this.updateDisplay);
  }
}
