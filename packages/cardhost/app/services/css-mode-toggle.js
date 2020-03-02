import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class CssModeToggleService extends Service {
  @tracked visible = true;
  @tracked dockLocation = 'right';
  @tracked width = 'small'; // width can be small, medium, or large

  @action
  dockRight() {
    this.dockLocation = 'right';
  }

  @action
  dockBottom() {
    this.dockLocation = 'bottom';
  }

  @action
  hideEditor() {
    this.visible = false;
  }

  @action
  showEditor() {
    this.visible = true;
  }

  @action
  setWidth(width) {
    // width can be small, medium, or large
    this.width = width;
  }
}
