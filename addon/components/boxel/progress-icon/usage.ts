import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
export default class extends Component {
  @tracked fractionComplete = 0.4;
  @tracked size = 24;
  @tracked isCancelled = false;
  @tracked isComplete = false;
}
