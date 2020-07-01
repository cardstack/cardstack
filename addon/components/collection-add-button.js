import Component from '@glimmer/component';
import { timeout } from "ember-concurrency";
import { task } from 'ember-concurrency-decorators';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { htmlSafe } from '@ember/template';

export default class CollectionAddButtonComponent extends Component {
  @tracked newItem;
  @tracked isAdding;
  @tracked dataSource = htmlSafe(`Searching for <span>${this.args.fieldName}</span> within <span>Verifi Registry</span>`);

  @task
  *addItem(newItemWrapper) {
    this.newItem = newItemWrapper.item || newItemWrapper;


    yield timeout(4000);

    this.args.addItem(this.newItem);

    this.newItem = null;
    this.isAdding = false;
  }

  @action focusSearch(container) {
    container.querySelector('input').focus();
  }
}
