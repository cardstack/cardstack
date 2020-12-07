import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class BoxelDropdown extends Component<{
  selected: any;
  onChange: (value: any) => void;
}> {
  @tracked selected = this.args.selected || null;

  @action
  updateSelected(selected: any) {
    this.selected = selected;
  }

  @action
  handleChange(value: any) {
    this.selected = value;

    if (this.args.onChange) {
      this.args.onChange(value);
    }

    return;
  }
}
