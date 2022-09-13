import Component from '@glimmer/component';
import { Link } from 'ember-link';
import { MenuItem } from '@cardstack/boxel/helpers/menu-item';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface TabBarArgs {
  items: MenuItem[];
}

export default class TabBar extends Component<TabBarArgs> {
  get linkItems(): MenuItem[] {
    return this.args.items.filter((item) => item.action instanceof Link);
  }
}
