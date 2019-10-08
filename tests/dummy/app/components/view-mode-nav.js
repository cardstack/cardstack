import Component from '@ember/component';
import { action, set } from '@ember/object';
import { tagName } from '@ember-decorators/component';

@tagName('')
export default class ViewModeNavComponent extends Component {
  showModeMenu = false;

  @action
  toggleModeMenu() {
    set(this, 'showModeMenu', !this.showModeMenu);
  }
}