import Service, { inject } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import type RouterService from '@ember/routing/router-service';

import { task } from 'ember-concurrency';

import CardsService from './cards';
import { Format, CardModel } from '@cardstack/core/src/interfaces';
import { taskFor } from 'ember-concurrency-ts';

type State =
  | {
      name: 'empty';
    }
  | {
      name: 'loading';
    }
  | {
      name: 'loaded';
      loadedCard: CardModel;
      component: unknown;
    };

export default class Modal extends Service {
  @inject declare cards: CardsService;
  @inject declare router: RouterService;

  @tracked state: State = { name: 'empty' };

  get isShowing(): boolean {
    return this.state.name === 'loading' || this.state.name === 'loaded';
  }

  get isLoading(): boolean {
    return this.state.name === 'loading';
  }

  get card(): CardModel | undefined {
    if (this.state.name === 'loaded') {
      return this.state.loadedCard;
    }
    return;
  }

  get cardComponent(): unknown {
    return this.card?.component;
  }

  openCard(card: string, format: Format): Promise<void> {
    return taskFor(this.openCardTask).perform(card, format);
  }

  @task async openCardTask(url: string, format: Format): Promise<void> {
    this.state = { name: 'loading' };

    let loadedCard = await this.cards.load(url, format);

    this.state = {
      name: 'loaded',
      loadedCard,
      component: await loadedCard.component(),
    };
  }

  @task async newCardTask(
    parentCard: CardModel,
    realm: string,
    withId: boolean
  ) {
    // this is a contrived example for our tests meant to demonstrate that an ID
    // can be supplied to a new card
    let id = withId
      ? `CUSTOM_ID_${Math.floor(Math.random() * 1000000)}`
      : undefined;

    this.state = { name: 'loading' };
    let editableParent = await parentCard.editable();
    let loadedCard = await editableParent.adoptIntoRealm(realm, id);
    this.state = {
      name: 'loaded',
      loadedCard,
      component: await loadedCard.component(),
    };
  }

  @task async editCardTask(card: CardModel): Promise<void> {
    this.state = { name: 'loading' };
    let loadedCard = await card.editable();
    this.state = {
      name: 'loaded',
      loadedCard,
      component: await loadedCard.component(),
    };
  }

  @action async save(): Promise<void> {
    if (this.state.name !== 'loaded') {
      return;
    }
    await this.state.loadedCard.save();
    this.router.transitionTo({
      queryParams: { url: this.state.loadedCard.url, format: 'isolated' },
    });
    this.close();
  }

  @action close(): void {
    this.state = { name: 'empty' };
  }
}
