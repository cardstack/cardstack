import Component from '@glimmer/component';
// @ts-ignore
import { task } from 'ember-concurrency';
import { AddressableCard } from '@cardstack/core/card';
import { tracked } from '@glimmer/tracking';

export default class CardTemplatesComponent extends Component<{
  catalogEntries: AddressableCard[] | undefined;
  openCardNameDialog: (title: string, adoptFromCard?: AddressableCard) => void;
}> {
  @tracked templates!: AddressableCard[];

  constructor(owner: unknown, args: any) {
    super(owner, args);

    this.loadTemplates.perform();
  }

  @(task(function*(this: CardTemplatesComponent) {
    if (Array.isArray(this.args.catalogEntries)) {
      this.templates = yield Promise.all(
        this.args.catalogEntries.map(entry => entry.value('card') as Promise<AddressableCard>)
      );
    } else {
      this.templates = [];
    }
  }).drop())
  loadTemplates: any;
}
