import Controller from '@ember/controller';
import { action } from '@ember/object';
import { formatId } from '@cardstack/boxel/utils/format-id';

export default class MediaRegistryItemController extends Controller {
  get itemId() {
    if (!this.model || !this.model.song_title) { return null; }
    return formatId(this.model.song_title);
  }

  @action
  transitionToEdit() {
    this.transitionToRoute('media-registry.item.edit', this.itemId);
  }

  @action
  transitionToView() {
    this.transitionToRoute('media-registry.item', this.itemId);
  }
}
