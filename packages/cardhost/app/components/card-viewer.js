import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import CardManipulator from './card-manipulator';

export default class CardViewer extends CardManipulator {
  @tracked isSelected = false;
  @tracked contextMenuOpen = false;

  resizeable = true;

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
