import Controller from '@ember/controller';
import { action } from '@ember/object';
import { titleize } from '@cardstack/boxel/utils/titleize';
import { formatId } from '@cardstack/boxel/utils/format-id';

export default class MediaRegistryItemController extends Controller {
  get itemId() {
    if (!this.model || !this.model.song_title) { return null; }
    return formatId(this.model.song_title);
  }

  get album() {
    if (!this.model.album) { return null; }
    return {
      type: this.model.type_of_album,
      title: titleize(this.model.album),
      imgURL: this.model.cover_art_thumb,
      fields: [
        {
          title: 'primary artist',
          value: this.model.artist
        },
        {
          title: 'label',
          value: this.model.owner
        }
      ]
    }
  }

  @action
  transitionToEdit() {
    this.transitionToRoute('media-registry.item.edit', this.itemId);
  }

  @action
  transitionToView() {
    this.transitionToRoute('media-registry.item', this.itemId);
  }

  @action
  transitionToProduct() {
    this.transitionToRoute('media-registry.products.album', formatId(this.model.album));
  }

  @action
  transitionToCatalog(id) {
    this.transitionToRoute('media-registry.collection', id);
  }
}
