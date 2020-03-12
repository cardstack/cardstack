import Component from '@glimmer/component';
// @ts-ignore
import { task } from 'ember-concurrency';
import { AddressableCard } from '@cardstack/core/card';
import { tracked } from '@glimmer/tracking';

export default class CatalogEntriesComponent extends Component<{
  catalogEntries: AddressableCard[] | undefined;
  openCardNameDialog: (title: string, adoptFromCard?: AddressableCard) => void;
}> {
  @tracked entries!: AddressableCard[];

  constructor(owner: unknown, args: any) {
    super(owner, args);

    this.loadCards.perform();
  }

  @(task(function*(this: CatalogEntriesComponent) {
    if (Array.isArray(this.args.catalogEntries)) {
      this.entries = yield Promise.all(
        this.args.catalogEntries.map(entry => entry.value('card') as Promise<AddressableCard>)
      );
    } else {
      this.entries = [];
    }
  }).drop())
  loadCards: any;
}
