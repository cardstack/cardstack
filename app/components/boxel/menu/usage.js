import Component from '@glimmer/component';
import { action } from '@ember/object';

export default class MenuComponent extends Component {
  @action log(message) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
  @action closeMenu() {
    // eslint-disable-next-line no-console
    console.log('closeMenu called');
  }
}
