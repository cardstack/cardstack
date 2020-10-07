import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { AddressableCard } from '@cardstack/hub';

export default class IsolatedCollection extends Component {
  @tracked format: string;
  @tracked collection!: AddressableCard[];

  constructor(owner: unknown, args: any) {
    super(owner, args);

    this.format = args.format || 'grid';
    this.collection = args.collection || [];
  }

  @action
  changeFormat(val: string) {
    this.format = val;
  }
}
