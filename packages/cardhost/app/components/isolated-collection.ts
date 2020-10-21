import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class IsolatedCollection extends Component<{
  search: () => void;
}> {
  @tracked format: string;
  @tracked selectedCards: string[];
  @tracked tableCols: object[] | null;
  @tracked sortColumns: object[];
  @tracked sortColumn: object | null;
  @tracked sortDirection = 'asc';

  constructor(owner: unknown, args: any) {
    super(owner, args);

    this.format = args.format || 'grid';
    this.selectedCards = args.selectedCards || [];
    this.tableCols = args.columns;
    this.sortColumns = [];
    this.sortColumn = this.sortColumns.length ? this.sortColumns[0] : null;
  }

  @action
  changeFormat(val: string) {
    this.format = val;
  }

  @action
  toggleSelect(id: string) {
    if (this.selectedCards.includes(id)) {
      this.selectedCards = this.selectedCards.filter(el => el !== id);
      return;
    }

    return (this.selectedCards = [...this.selectedCards, id]);
  }

  @action
  search() {
    // TODO: move functionality over from boxel repo
    return;
  }

  @action
  async sort() {
    // TODO: move functionality over from boxel repo
    return;
  }
}
