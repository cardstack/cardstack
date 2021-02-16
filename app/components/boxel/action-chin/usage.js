import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class ActionChinUsage extends Component {
  @tracked mode = 'data-entry';
  @tracked buttonText = 'Save';
  @action toggleMode() {
    this.mode = this.mode === 'data-entry' ? 'memorialized' : 'data-entry';
  }
}
