import CardManipulator from './card-manipulator';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class CardViewer extends CardManipulator {
  @service router;
  @service cardstackSession;

  @tracked isSelected = false;
  @tracked contextMenuOpen = false;

  resizeable = true;

  get cardJson() {
    if (!this.args.card) {
      return null;
    }
    return JSON.stringify(this.args.card.json, null, 2);
  }

  @action
  setSelected(bool) {
    this.isSelected = bool;
    if (!bool) {
      // When the card header is closed, we need to set the context menu to closed as well.
      // Otherwise, when you hover over the card again, you will see the context menu
      // without clicking on the ... button
      this.contextMenuOpen = false;
    }
  }

  @action
  setContextMenu(bool) {
    this.contextMenuOpen = bool;
  }
}
