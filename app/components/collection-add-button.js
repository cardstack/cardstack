import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { htmlSafe } from '@ember/template';

export default class CollectionAddButtonComponent extends Component {
  @tracked newItem;
  @tracked isAdding;
  @tracked dataSource = htmlSafe(
    `Searching for <span>${this.args.fieldName}</span> within <span>Verifi Registry</span>`
  );

  @action
  addItem(newItemWrapper) {
    this.newItem = newItemWrapper.item || newItemWrapper;
    this.args.addItem(this.newItem);
    this.isAdding = false;
  }

  @action focusSearch(container) {
    container.querySelector('input').focus();
  }
}
