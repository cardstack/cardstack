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
      new: boolean;
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

  get cardComponent(): unknown {
    if (this.state.name === 'loaded') {
      return this.state.loadedCard.component;
    }
    return;
  }

  // TODO: Consolidate with edit new
  openCard(cardURL: string, format: Format): Promise<void> {
    return taskFor(this.openCardTask).perform(cardURL, format);
  }

  @task *openCardTask(cardURL: string, format: Format): TaskGenerator<void> {
    this.state = { name: 'loading' };
    let loadedCard = yield this.cards.load(cardURL, format);
    this.state = {
      name: 'loaded',
      loadedCard,
      format,
      new: false,
    };
  }

  @task *editCard(card: Card): TaskGenerator<void> {
    this.state = { name: 'loading' };
    let loadedCard = yield this.cards.loadForEdit(card);
    this.state = {
      name: 'loaded',
      loadedCard,
      format: 'edit',
      new: false,
    };
  }

  @task *newCard(card: Card): TaskGenerator<void> {
    this.state = { name: 'loading' };
    let loadedCard = yield this.cards.loadForNew(card);
    this.state = {
      name: 'loaded',
      loadedCard,
      format: 'edit',
      new: true,
    };
  }

  @action async save(): Promise<void> {
    if (this.state.name !== 'loaded') {
      return;
    }
    await this.cards.save(this.state.loadedCard);
    if (this.state.new) {
      this.router.transitionTo(`/card?url=${this.state.loadedCard.model.url}`);
    }
    this.close();
  }

  @action close(): void {
    this.state = { name: 'empty' };
  }
}
