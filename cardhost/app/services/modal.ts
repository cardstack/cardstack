import Service, { inject } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import type RouterService from '@ember/routing/router-service';

import { task, TaskGenerator } from 'ember-concurrency';
// import { taskFor } from 'ember-concurrency-ts';

import { Card } from './cards';
import CardsService from '../services/cards';
import { Format } from '@cardstack/core/src/interfaces';
import { taskFor } from 'ember-concurrency-ts';
import { newCardParams } from '@cardstack/core/src/card-model';

type State =
  | {
      name: 'empty';
    }
  | {
      name: 'loading';
    }
  | {
      name: 'loaded';
      loadedCard: Card;
      format: Format;
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

  get card(): Card | undefined {
    if (this.state.name === 'loaded') {
      return this.state.loadedCard;
    }
    return;
  }
  get cardComponent(): unknown {
    return this.card && this.card.component;
  }

  openCard(card: string, format: Format): Promise<void> {
    return taskFor(this.openCardTask).perform(card, format);
  }

  @task *openCardTask(url: string, format: Format): TaskGenerator<void> {
    this.state = { name: 'loading' };

    let loadedCard = yield this.cards.load(url, format);

    this.state = {
      name: 'loaded',
      loadedCard,
      format,
    };
  }

  @task *editCardTask(
    card: Card,
    cardParams?: newCardParams | Event
  ): TaskGenerator<void> {
    if (cardParams instanceof Event) {
      cardParams = undefined;
    }

    this.state = { name: 'loading' };
    let loadedCard = yield this.cards.loadForEdit(card, cardParams);
    this.state = {
      name: 'loaded',
      loadedCard,
      format: 'edit',
    };
  }

  @action async save(): Promise<void> {
    if (this.state.name !== 'loaded') {
      return;
    }
    await this.cards.save(this.state.loadedCard);
    this.router.transitionTo({
      queryParams: { url: this.state.loadedCard.model.url, format: 'isolated' },
    });
    this.close();
  }

  @action close(): void {
    this.state = { name: 'empty' };
  }
}
