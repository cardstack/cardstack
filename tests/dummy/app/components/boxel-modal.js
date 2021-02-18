import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class BoxelModalComponent extends Component {
  @tracked onClose = this.args.onClose || (() => {});
}
