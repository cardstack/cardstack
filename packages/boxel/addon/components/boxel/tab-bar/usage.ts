import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class TabBarUsage extends Component {
  @tracked backgroundColor = 'inherit';
  @tracked borderBottom = '1px solid var(--boxel-light-500)';
  @tracked font = 'inherit';
  @tracked fontWeightHover = '600';

  @tracked spread = false;

  @action log(message: string): void {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}
