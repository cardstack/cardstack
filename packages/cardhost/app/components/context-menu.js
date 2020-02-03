import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class ContextMenuComponent extends Component {
  @tracked menuIsExpanded = false;

  @action
  toggleMenu() {
    this.menuIsExpanded = !this.menuIsExpanded;
  }
}
