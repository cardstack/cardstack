import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

interface Column {
  name: string;
  sortType: string;
}
const SORTABLE_COLUMNS = [
  { name: 'Title', sortType: 'alpha' },
  { name: 'Rating', sortType: 'numeric' },
  { name: 'Author', sortType: 'alpha' },
] as Column[];

export default class SortMenuUsageComponent extends Component {
  sortableColumns = SORTABLE_COLUMNS;
  @tracked sortedColumn = SORTABLE_COLUMNS[0];
  @tracked sortedDirection = 'asc';

  @action sort(column: Column, direction: string): void {
    this.sortedColumn = column;
    this.sortedDirection = direction;
  }
}
