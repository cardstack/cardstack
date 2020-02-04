import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class CardRendererHeaderComponent extends Component {
  @service cardstackSession;
  @tracked contextMenuOpened = false;

  @action
  toggleMenu() {
    this.contextMenuOpened = !this.contextMenuOpened;
  }

  // When the header is hidden behind the card, we need to close
  // the menu and save the closed state. Otherwise, if the user
  // hovers over the card again, the header would pop up with this
  // menu stil open.
  @action
  resetMenu() {
    this.contextMenuOpened = false;
  }

  get showContextMenu() {
    return (this.contextMenuOpened && this.args.cardSelected) || (this.contextMenuOpened && this.args.alwaysShowHeader);
  }
}
