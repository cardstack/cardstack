import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class CssModeToggleService extends Service {
  @tracked editingCss;
  @tracked dockLocation = "bottom";

  setEditingCss(value) {
    this.editingCss = value;
  }

  @action
  dockRight() {
    this.dockLocation = "right";
  }

  @action
  dockBottom() {
    this.dockLocation = "bottom";
  }
}
