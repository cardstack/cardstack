import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
// @ts-ignore
import { task } from 'ember-concurrency';

export default class IsolatedCollection extends Component<{
  collection: [];
  search: () => void;
}> {
  @tracked format: string;
  @tracked selectedCards: string[];
  @tracked tableCols!: object[] | null;
  @tracked tableVals!: object[];
  @tracked sortColumns: object[];
  @tracked sortColumn!: object | null;
  @tracked sortDirection = 'asc';

  constructor(owner: unknown, args: any) {
    super(owner, args);

    this.format = args.format || 'grid';
    this.selectedCards = args.selectedCards || [];
    this.tableCols = args.columns;
    this.tableVals = [];
    this.sortColumns = [];
    this.sortColumn = this.sortColumns.length ? this.sortColumns[0] : null;
  }

  @action
  changeFormat(val: string) {
    this.format = val;

    if (this.format === 'table') {
      this.loadTableValues.perform();
    }
  }

  @task(function*(this: IsolatedCollection) {
    yield Promise.all(this.args.collection.map(card => this.loadCardValue.perform(card)));
  })
  loadTableValues: any;

  @task(function*(this: IsolatedCollection, card: any) {
    let hasField = yield card.hasField('heading');
    if (!hasField) {
      return;
    }
    let val = yield card.value('heading');
    this.tableVals = [...this.tableVals, { title: val }];
    return;
  })
  loadCardValue: any;

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
