import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class IsolatedCollection extends Component {
  queryParams = ['format'];

  @tracked format;
  @tracked collection = [];

  constructor(...args) {
    super(...args);

    this.format = 'grid';
  }

  @action
  changeFormat(val) {
    this.format = val;
  }
}
