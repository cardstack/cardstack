import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class TrayComponent extends Component {
  @tracked expanded = false;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  trayAction() {}

  @action
  isolate() {
    this.expanded = true;
  }
}
