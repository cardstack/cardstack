import Controller from '@ember/controller';
import { action } from '@ember/object';
import { dasherize } from '@ember/string';
import { truncateVerifiId } from '@cardstack/boxel/utils/truncate-verifi-id';

export default class MediaRegistryItemController extends Controller {
  get headerDetailFields() {
    return [
      {
        title: 'catalog no.',
        value: this.model?.details?.catalog_no
      },
      {
        title: 'verifi id',
        value: truncateVerifiId(this.model?.details?.verifi_id)
      },
      {
        title: 'label',
        value: this.model.owner
      },
    ];
  }

  get itemId() {
    return dasherize(this.model?.song_title.trim());
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
