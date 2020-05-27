import Controller from '@ember/controller';
import { action } from '@ember/object';

export default class MediaRegistryItemEditController extends Controller {
  @action
  transitionToPrevious() {
    this.transitionToRoute('media-registry.item', this.model);
  }
}
