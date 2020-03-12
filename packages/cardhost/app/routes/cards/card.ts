import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import DataService from '../../services/data';
import { AddressableCard } from '@cardstack/core/card';
import { action } from '@ember/object';
import { set } from '@ember/object';

export interface RouteParams {
  id: string;
}

export interface Model {
  card: AddressableCard;
  isDirty: boolean;
}

export default class CardsCard extends Route {
  @service data!: DataService;
  @service autosave!: {
    setCardModel: any; // this is actually a task which is really hard to describe in TS
    saveCard: any; // this is actually a task which is really hard to describe in TS
    bindCardUpdated: (fn: Function) => void;
  };

  async model({ id }: RouteParams): Promise<Model> {
    await Promise.resolve(this.autosave.saveCard.last);
    return {
      card: await this.data.load(id, 'everything'),
      isDirty: false, // This is a temporary place to track model dirtiness until we integrate OrbitJS
    };
  }

  async beforeModel() {
    this.autosave.bindCardUpdated(this.updateCardModel.bind(this));
    await this.autosave.setCardModel.perform().then();
  }

  async afterModel(model: Model) {
    await this.autosave.setCardModel.perform(model).then();
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

  @action
  updateCardModel(card: AddressableCard, isDirty: boolean) {
    let model = this.modelFor(this.routeName) as Model;

    // This is to guard against an autosave that was kicked off right as we
    // switched routes. This protects against the case where the model that we
    // care about for our route is for a different card now. In that scenario,
    // this invocation can be disregarded (we'll pick up the updated model state
    // the next time we enter the old card's route via the data service's load
    // method).
    if (model.card.canonicalURL === card.canonicalURL) {
      set(model, 'isDirty', isDirty);
      set(model, 'card', card);
    }
  }
}
