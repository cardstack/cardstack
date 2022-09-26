import Component from '@glimmer/component';
import { action } from '@ember/object';
import { Link } from 'ember-link';
import { type MenuItem } from '@cardstack/boxel/helpers/menu-item';
import { type EmptyObject } from '@ember/component/helper';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    closeMenu: () => void;
    items: Array<MenuItem>;
  };
  Blocks: EmptyObject;
}

export default class Menu extends Component<Signature> {
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

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Menu': typeof Menu;
  }
}
