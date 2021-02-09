import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class DropdownButtonUsageComponent extends Component {
  @tracked button = 'gear';
  @tracked icon;
  @tracked size = 30;
  @tracked iconSize = 16;

  @action log(message) {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}
