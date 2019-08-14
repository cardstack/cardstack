import { action } from '@ember/object';
import { tagName, layout as templateLayout } from '@ember-decorators/component';
import Component from '@ember/component';
import layout from '../templates/components/tray';

@templateLayout(layout)
@tagName('')
export default class TrayComponent extends Component {
  expanded = false;
  trayAction() {}

  @action
  isolate() {
    this.set('expanded', true);
  }
}
