import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class TabBarUsage extends Component {
  @tracked spread = false;

  @action log(message: string): void {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}
