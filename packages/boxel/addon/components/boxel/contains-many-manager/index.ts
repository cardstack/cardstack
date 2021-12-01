import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

interface ContainsManyModel {
  model: unknown[];
  set: (model: unknown[]) => void;
}

export default class ContainsManyManager extends Component<ContainsManyModel> {
  @tracked items: unknown[] = [];

  @action copyItems(): void {
    this.items = this.args.model ?? [];
  }

  @action setItem(i: number, val: unknown): void {
    this.items[i] = val;
    this.args.set(this.items);
  }

  @action addItem(): void {
    if (this.items.length) {
      let newItem = Object.assign({}, this.items[0]);
      this.items = [...this.items, newItem];
    } else {
      this.items = [...this.items, null];
    }
    this.args.set(this.items);
  }

  @action removeItem(i: number): void {
    this.items = this.items.filter((_, index) => index !== i);
    this.args.set(this.items);
  }
}
