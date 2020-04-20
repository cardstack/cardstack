import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class CollectionIsolatedComponent extends Component {
  @tracked format = this.args.format || 'grid';

  @action
  close() {
    if (this.args.close) {
      this.args.close();
    }
  }

  @action
  changeFormat(val) {
    if (this.args.changeFormat) {
      this.args.changeFormat(val);
    }
    this.format = val;
  }
}
