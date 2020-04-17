import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class MovieRegistryEditCollectionViewController extends Controller {
  @tracked isModalOpen = true;

  @action
  closeModal() {
    this.isModalOpen = false;
    this.transitionToRoute('movie-registry.edit');
  }
}
