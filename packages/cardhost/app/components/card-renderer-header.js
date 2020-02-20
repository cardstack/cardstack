import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

/*
This component has two modes, essentially.

First, it can operate using only local
properties and actions. If the CardRenderer should _always_ show the header,
then this component gets to manage its own state.

Second, it can take a setContextMenu action, contextMenuOpen bool, and cardSelected bool
arguments from the parent. They will only work if all 3 are present.
This is used when the card header is shown conditionally, i.e. on hover.
The parent controls the state because we need to make sure that when the header
disappears, the submenu closes too.
*/

export default class CardRendererHeaderComponent extends Component {
  @service cardstackSession;
  @service autosave;
  @tracked localMenuOpen = false;

  @action
  toggleMenu() {
    if (this.args.setContextMenu) {
      // if a setContextMenu function exists, use it, and rely only on state from the parent
      let newVal = !this.args.contextMenuOpen;
      this.localMenuOpen = !this.localMenuOpen;
      this.args.setContextMenu(newVal);
    } else {
      this.localMenuOpen = !this.localMenuOpen;
    }
  }

  get showMenu() {
    if (this.args.setContextMenu) {
      // if a setContextMenu function exists, use it, and rely only on state from the parent
      return this.localMenuOpen && this.args.cardSelected;
    } else {
      return this.localMenuOpen;
    }
  }

  @action
  resetMenu() {
    if (!this.args.cardSelected) {
      this.localMenuOpen = false;
    }
  }
}
