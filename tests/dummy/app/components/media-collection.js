import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class MediaCollectionComponent extends Component {
  @tracked format = this.args.format || 'grid';

  @action
  changeFormat(val) {
    if (this.args.changeFormat) {
      this.args.changeFormat(val);
    }
    this.format = val;
  }

  @action
  toggleSelectAll() {}
}
