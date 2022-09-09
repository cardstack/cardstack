import Component from '@glimmer/component';
import { Link } from 'ember-link';
import { MenuItem } from '@cardstack/boxel/helpers/menu-item';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface LeftMainNavArgs {
  items: MenuItem[];
}

export default class LeftMainNav extends Component<LeftMainNavArgs> {
  get linkItems() {
    return this.args.items.filter((item) => item.action instanceof Link);
  }
}
