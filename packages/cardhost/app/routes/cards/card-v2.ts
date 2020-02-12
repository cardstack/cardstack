import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import DataService from '../../services/data';
import { Card } from '@cardstack/core/card';

export interface RouteParams {
  id: string;
}

export default class CardsCardV2 extends Route {
  @service data!: DataService;

  model({ id }: RouteParams): Promise<Card> {
    return this.data.load(id, 'everything');
  }

  serialize(model: Card): RouteParams {
    let id = model.canonicalURL;
    if (id) {
      return { id };
    }
    throw new Error(`Cannot render an unsaved card in the ${this.routeName} route`);
  }
}
