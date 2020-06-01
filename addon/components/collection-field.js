import Component from '@glimmer/component';
import { action } from '@ember/object';

export default class CollectionField extends Component {
  newItem = 1; 

  @action addItem(item) {
    this.args.collection.push(item);
  }

}
