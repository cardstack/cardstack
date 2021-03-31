import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class extends Component {
  @tracked isPartial = false;
  @tracked isSelected = false;
  @tracked mode = 'view';

  @action onClick(): void {
    if (this.isSelected) {
      this.isSelected = false;
    } else if (this.isPartial) {
      this.isPartial = false;
    } else {
      this.isPartial = true;
      this.isSelected = true;
    }
  }
}
