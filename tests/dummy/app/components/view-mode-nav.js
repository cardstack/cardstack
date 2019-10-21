import Component from '@glimmer/component';
import { action, set } from '@ember/object';

export default class ViewModeNavComponent extends Component {
  showModeMenu = false;

  @action
  toggleModeMenu() {
    set(this, 'showModeMenu', !this.showModeMenu);
  }
}