import Route from '@ember/routing/route';
import { tracked } from '@glimmer/tracking';
import { dasherize } from '@ember/string';
import { AddressableCard } from '@cardstack/hub';
import { Model } from '../collection';

interface RouteParams {
  id: string;
}

export default class CollectionViewRoute extends Route {
  @tracked collectionEntries: AddressableCard[] = [];
  @tracked collectionId!: string;

  async model({ id }: RouteParams): Promise<Model> {
    let { org, cards, columns } = (await this.modelFor('cards.collection')) as Model;

    if (org && cards.length && org.collection === id) {
      this.collectionId = org.collection;
      this.collectionEntries = cards.filter((el: any) => {
        // using the formatted csTitle field for the collection card type
        // TODO: better way to filter out collection cards
        if (el.csTitle) {
          return dasherize(el.csTitle.toLowerCase()) === this.collectionId;
        }
      });
    }

    return {
      id,
      org,
      cards: this.collectionEntries,
      columns,
    };
  }
}
