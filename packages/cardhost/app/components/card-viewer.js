import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import CardManipulator from './card-manipulator';

export default class CardViewer extends CardManipulator {
  @tracked contextMenuOpen = false;

  resizeable = true;

  @action
  setContextMenu(bool) {
    this.contextMenuOpen = bool;
  }
}
