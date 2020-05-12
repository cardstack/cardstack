import Controller from '@ember/controller';
import { action } from '@ember/object';

export default class MediaRegistryEditController extends Controller {
  @action
  transitionToPrevious() {
    this.transitionToRoute('media-registry');
  }
}
