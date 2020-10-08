import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class IsolatedCollection extends Component {
  @tracked format: string;
  @tracked selectedCards: string[];

  constructor(owner: unknown, args: any) {
    super(owner, args);

    this.format = args.format || 'grid';
    this.selectedCards = args.selectedCards || [];
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
}
