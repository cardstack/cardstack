import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class CssModeToggleService extends Service {
  @tracked visible = true;
  @tracked dockLocation = 'right';
  @tracked isResponsive = true;

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
  useFullWidth() {
    this.isResponsive = false;
  }

  @action
  useResponsiveWidth() {
    this.isResponsive = true;
  }
}
