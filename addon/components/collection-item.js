import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class CollectionItemComponent extends Component {
  @tracked mode = this.args.mode || 'view';
  @tracked format = this.args.format || 'list';
}
