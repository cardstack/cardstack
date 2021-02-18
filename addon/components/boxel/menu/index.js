import Component from '@glimmer/component';
import { action } from '@ember/object';

export default class Menu extends Component {
  @action invokeMenuItemAction(actionOrLink, e) {
    e.preventDefault();
    let { closeMenu } = this.args;
    closeMenu && closeMenu.call();
    if (actionOrLink.transitionTo) {
      actionOrLink.transitionTo(e);
    } else {
      actionOrLink.call();
    }
  }
}
