import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class LibraryService extends Service {
  @tracked visible = false;

  @action
  displayLibrary(isVisible) {
    this.visible = isVisible;
  }
}
