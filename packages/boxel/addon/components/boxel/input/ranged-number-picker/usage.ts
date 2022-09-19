import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class BoxelInputRangedNumberPickerUsage extends Component {
  @tracked min = 1;
  @tracked max = 30;
  @tracked placeholder = '';

  @action logValue(value: number): void {
    console.log(value);
  }
}
