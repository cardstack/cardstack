import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

type Width = 'small' | 'medium' | 'large';
type DockLocation = 'right' | 'bottom';

export default class CssModeToggleService extends Service {
  @tracked visible = true;
  @tracked dockLocation: DockLocation = 'right';
  @tracked width: Width = 'small';

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
  setWidth(width: Width) {
    this.width = width;
  }
}
