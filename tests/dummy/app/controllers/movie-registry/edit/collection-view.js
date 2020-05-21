import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { compare } from '@ember/utils';
import { get } from '@ember/object';


export default class MovieRegistryEditCollectionViewController extends Controller {
  queryParams = ['format'];
  @tracked format = 'grid';
  @tracked isModalOpen = true;

  @action
  closeModal() {
    this.isModalOpen = false;
    this.transitionToRoute('movie-registry.edit');
  }

  @action
  changeFormat(format) {
    this.format = format;
  }

  @action async sort(column, direction) {
    let multiplier = (direction === 'asc') ? 1 : -1;
    return this.model.value.sort((a, b) => multiplier * compare(get(a, column.valuePath), get(b, column.valuePath)))

  }

}
