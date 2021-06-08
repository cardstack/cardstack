import { Format } from '@cardstack/core/src/interfaces';
import Service, { inject } from '@ember/service';
import { tracked } from '@glimmer/tracking';

import { task } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';

import { LoadedCard } from './cards';
import CardsService from '../services/cards';
import { action } from '@ember/object';

export default class Modal extends Service {
  @inject declare cards: CardsService;

  @tracked isShowing = false;

  @tracked state?: {
    format: Format;
    url: string;
    loadedCard: LoadedCard;
  };

  @task openWithCard = taskFor(
    async (url: string, format: Format): Promise<void> => {
      this.isShowing = true;

      let loadedCard = await this.cards.load(url, format);

      this.state = {
        loadedCard,
        format,
        url,
      };
    }
  );

  @action async save(): Promise<void> {
    if (!this.state) {
      return;
    }
    await this.cards.save(this.state.url, this.state.loadedCard.model);
    this.close();
  }

  @action close(): void {
    this.isShowing = false;
    this.state = undefined;
  }
}
