import Component from '@glimmer/component';
import { action } from '@ember/object';
import { Link } from 'ember-link';
import '@cardstack/boxel/styles/global.css';
import './index.css';

export default class TabBar extends Component {
  invokeMenuItemAction(actionOrLink: () => never, e: Event): void;
  invokeMenuItemAction(actionOrLink: Link, e: Event): void;
  @action invokeMenuItemAction(actionOrLink: unknown, e: Event): void {
    if (!(actionOrLink instanceof Link)) {
      e.preventDefault();
      (actionOrLink as () => never)();
    }
  }
}
