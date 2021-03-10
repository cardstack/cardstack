import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

export default class SearchboxUsage extends Component {
  @tracked value = '';
  @tracked id = 'searchbox-id';
  @tracked label = 'A searchbox example input';
  @tracked placeholder = 'Search';

  @action onInput(e) {
    console.log('input:', e.target.value);
    this.value = e.target.value;
  }

  @action onChange(e) {
    console.log('change', e.target.value);
  }

  @action onClear() {
    this.value = '';
  }
}
