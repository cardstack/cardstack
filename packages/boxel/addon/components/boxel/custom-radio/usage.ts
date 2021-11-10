import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';
import { action } from '@ember/object';
import './usage.css';

export default class CustomRadioUsage extends Component {
  @tracked items = A([
    {
      id: 'eggs',
      text: 'eggs',
    },
    {
      id: 'tofu',
      text: 'tofu',
    },
    {
      id: 'strawberry',
      text: 'strawberry',
    },
  ]);
  @tracked groupDescription =
    'Select one of these options for breakfast sandwiches';
  @tracked checkedId = 'strawberry';
  @tracked disabled = false;

  @action onChange(id: string): void {
    this.checkedId = id;
  }
}
