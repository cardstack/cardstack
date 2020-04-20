import Component from '@glimmer/component';
import { action } from '@ember/object';

export default class CollectionIsolatedComponent extends Component {
  @action close() {
    if (this.args.close) {
      this.args.close();
    }
  }
}
