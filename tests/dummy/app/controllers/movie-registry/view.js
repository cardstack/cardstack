import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class MovieRegistryViewController extends Controller {
  mode = 'view';
  @tracked isModalOpen = true;

  @action
  closeModal() {
    this.isModalOpen = false;
    this.transitionToRoute('index');
  }
}
