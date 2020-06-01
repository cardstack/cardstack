import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

export default class CardComponent extends Component {
  @tracked expandAction = this.args.expandAction || (() => {});
}
