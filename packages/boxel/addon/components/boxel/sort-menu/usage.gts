import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelSortMenu from './index';
import type { Column, SortDirection } from './item';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { fn, array } from '@ember/helper';

const SORTABLE_COLUMNS = [
  { name: 'Title', sortType: 'alpha' },
  { name: 'Rating', sortType: 'numeric' },
  { name: 'Author', sortType: 'alpha' },
] as Column[];

export default class SortMenuUsage extends Component {
  sortableColumns = SORTABLE_COLUMNS;
  @tracked sortedColumn = SORTABLE_COLUMNS[0];
  @tracked sortedDirection: SortDirection = 'asc';

  @action sort(column: Column, direction: SortDirection): void {
    this.sortedColumn = column;
    this.sortedDirection = direction;
  }

  <template>
    <FreestyleUsage @name="SortMenu">
      <:example>
        <BoxelSortMenu
          @sortableColumns={{this.sortableColumns}}
          @sortedColumn={{this.sortedColumn}}
          @sortedDirection={{this.sortedDirection}}
          @onSort={{this.sort}}
        />
      </:example>
      <:api as |Args|>
        <Args.Object
          @name="sortedColumn"
          @description="The column currently being sorted by (property must include 'name' and 'sortType')"
          @value={{this.sortedColumn}}
        />
        <Args.String
          @name="sortedDirection"
          @value={{this.sortedDirection}}
          @options={{array "asc" "desc"}}
          @description="The direction of the current sort, asc or desc"
          @onInput={{fn (mut this.sortedDirection)}}
        />
        <Args.Object
          @name="sortableColumns"
          @description="columns that can be sorted, properties must include 'name' and 'sortType' ('numeric' or 'alpha')"
          @value={{this.sortableColumns}}
          @required={{true}}
        />
        <Args.Action
          @name="onSort"
          @description="Invoked when user clicks a menu item with the column and direction"
          @value={{this.sort}}
          @required={{true}}
        />
      </:api>
    </FreestyleUsage>
  </template>
}
