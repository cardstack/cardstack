import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { titleize } from 'dummy/utils/titleize';
import { formatId } from 'dummy/utils/format-id';

export default class MediaRegistryItemController extends Controller {
  @service router;

  get album() {
    if (!this.model.album) {
      return null;
    }
    return {
      type: this.model.type_of_album,
      title: titleize(this.model.album),
      imgURL: this.model.cover_art_thumb,
      fields: [
        {
          title: 'primary artist',
          value: this.model.artist,
        },
        {
          title: 'label',
          value: this.model.label,
        },
      ],
    };
  }

  @action
  transitionToEdit() {
    this.router.transitionTo('media-registry.item.edit', this.model.id);
  }

  @action
  transitionToView() {
    this.router.transitionTo('media-registry.item', this.model.id);
  }

  @action
  transitionToProduct() {
    this.router.transitionTo(
      'media-registry.products.album',
      formatId(this.model.album)
    );
  }

  @action
  transitionToCatalog(id) {
    this.router.transitionTo('media-registry.collection', id);
  }
}
