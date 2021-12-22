import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { A } from '@ember/array';
import { action } from '@ember/object';

export default class RadioInputUsage extends Component {
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
  @tracked hiddenInput = false;
  @tracked hiddenBorder = false;
  @tracked spacing = '';
  @tracked layout = 'default (flex)';
  @tracked containerWidth = '';
  @tracked gridColumnWidth = '';

  @action onChange(id: string): void {
    this.checkedId = id;
  }
}
