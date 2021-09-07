import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class IconButtonUsageComponent extends Component {
  @tracked icon = 'expand';
  @tracked variant: string | null = null;
  @tracked width = '16px';
  @tracked height = '16px';
  @action log(message: string): void {
    // eslint-disable-next-line no-console
    console.log(message);
  }
}
