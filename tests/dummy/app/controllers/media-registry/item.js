import Controller from '@ember/controller';
import { action } from '@ember/object';
import { dasherize } from '@ember/string';

export default class MediaRegistryItemController extends Controller {
  truncatedVerifiId = function(id) {
    if (id) {
      return `${id.slice(0, 6)}...${id.slice(-4)}`;
    }
  };

  get headerDetailFields() {
    return [
      {
        title: 'catalog no.',
        value: this.model?.details?.catalog_no
      },
      {
        title: 'verifi id',
        value: this.truncatedVerifiId(this.model?.details?.verifi_id)
      },
      {
        title: 'label',
        value: this.model.owner
      },
    ];
  }

  @action
  transitionToEdit() {
    let itemId = dasherize(this.model.song_title.trim());
    this.transitionToRoute('media-registry.item.edit', itemId);
  }
}
