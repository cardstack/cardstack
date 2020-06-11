import Controller from '@ember/controller';
import { action } from '@ember/object';
import { dasherize } from '@ember/string';

export default class MediaRegistryItemController extends Controller {
  get itemId() {
    if (!this.model || !this.model.song_title) { return null; }
    return String(dasherize(this.model.song_title.trim()));
  }

  @action
  transitionToEdit() {
    this.transitionToRoute('media-registry.item.edit', this.itemId);
  }

  @action
  transitionToView() {
    this.transitionToRoute('media-registry.item', this.itemId);
  }

  // TODO: Fix this (currently all cards expand to musical work card)
  @action
  transitionToMusicalWork() {
    this.transitionToRoute('media-registry.item.musical-work', this.itemId);
  }
}
