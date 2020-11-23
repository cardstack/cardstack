import { AddressableCard } from '@cardstack/hub';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
//@ts-ignore
import { task } from 'ember-concurrency';

export default class RelatedCards extends Component<{
  card: AddressableCard;
  loadRelatedCards: () => void;
}> {
  @tracked relatedCards!: AddressableCard[] | [];

  constructor(owner: unknown, args: any) {
    super(owner, args);

    this.loadRelatedCards.perform();
  }

  @task(function*(this: RelatedCards) {
    this.relatedCards = yield this.args.card.value('related-recordings');
  })
  loadRelatedCards: any;
}
