import Controller from '@ember/controller';
import { action } from '@ember/object';

export default class MediaRegistryCollectionEditController extends Controller {
  @action
  transitionToPrevious() {
    this.transitionToRoute('media-registry.collection', this.model.title);
  }
}
