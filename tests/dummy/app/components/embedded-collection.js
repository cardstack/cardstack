import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class EmbeddedCollection extends Component {
  @tracked displayCount = 3;
  @tracked isViewAll = this.displayCount === this.args.collection.length;
  @tracked expanded = false;

  @action
  viewAll() {
    this.displayCount = this.args.collection.length;
    this.expanded = true;
  }

  @action
  collapse() {
    this.displayCount = 3;
    this.expanded = false;
  }
}
