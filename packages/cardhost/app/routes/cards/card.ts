import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import DataService from '../../services/data';
import { AddressableCard } from '@cardstack/core/card';

export interface RouteParams {
  id: string;
}

export interface Model {
  card: AddressableCard;
  isDirty: boolean;
}

export default class CardsCard extends Route {
  @service data!: DataService;

  async model({ id }: RouteParams): Promise<Model> {
    return {
      card: await this.data.load(id, 'everything'),
      isDirty: false, // This is a temporary place to track model dirtiness until we integrate OrbitJS
    };
  }

  serialize(model: Model): RouteParams {
    let { card } = model;
    if (!card) {
      throw new Error(`Cannot render the ${this.routeName} route when no card is provided in model`);
    }

    let id = card.canonicalURL;
    if (id) {
      return { id };
    }
    throw new Error(`Cannot render an unsaved card in the ${this.routeName} route`);
  }
}
