import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class TrayComponent extends Component {
  @tracked expanded = false;
  trayAction() {}

  @action
  isolate() {
    this.expanded = true;
  }
}
