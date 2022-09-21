import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class RadioInputUsage extends Component {
  @tracked groupDescription = 'Select one';
  @tracked disabled = false;

  @action logValue(value: string): void {
    console.log(value);
  }
}
