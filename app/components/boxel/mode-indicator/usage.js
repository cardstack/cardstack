import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class ModeIndicatorUsageComponent extends Component {
  @tracked mode = 'edit';

  @action log(message) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}
