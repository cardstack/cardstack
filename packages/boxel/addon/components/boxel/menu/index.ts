import Component from '@glimmer/component';
import { action } from '@ember/object';
import { Link } from 'ember-link';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface MenuArgs {
  closeMenu: () => never;
}

export default class Menu extends Component<MenuArgs> {
  invokeMenuItemAction(actionOrLink: () => never, e: Event): void;
  invokeMenuItemAction(actionOrLink: Link, e: Event): void;
  @action invokeMenuItemAction(actionOrLink: unknown, e: Event): void {
    e.preventDefault();
    let { closeMenu } = this.args;
    closeMenu && closeMenu();
    if (actionOrLink instanceof Link && actionOrLink.transitionTo) {
      actionOrLink.transitionTo();
    } else {
      (actionOrLink as () => never)();
    }
  }
}
