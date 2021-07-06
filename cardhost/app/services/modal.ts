import Service, { inject } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

import { task } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';

import { Card } from './cards';
import CardsService from '../services/cards';
import type CardModel from '@cardstack/core/src/base-component-model';
import { Format } from '@cardstack/core/src/interfaces';

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

  get isShowing(): boolean {
    return this.state.name === 'loading' || this.state.name === 'loaded';
  }

  get isLoading(): boolean {
    return this.state.name === 'loading';
  }

  @tracked state: State = { name: 'empty' };

  get cardComponent(): unknown {
    if (this.state.name === 'loaded') {
      return this.state.loadedCard.component;
    }
    return;
  }

  @task editCard = taskFor(
    async (model: CardModel): Promise<void> => {
      this.state = { name: 'loading' };
      let loadedCard = await this.cards.loadForEdit(model);
      this.state = {
        name: 'loaded',
        loadedCard,
        format: 'edit',
      };
    }
  );

  @action async save(): Promise<void> {
    if (this.state.name !== 'loaded') {
      return;
    }
    await this.cards.save(this.state.loadedCard.model);
    this.close();
  }

  @action close(): void {
    this.state = { name: 'empty' };
  }
}
