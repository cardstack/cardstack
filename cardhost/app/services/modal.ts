import { Format } from '@cardstack/core/src/interfaces';
import Service, { inject } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

import { task } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';

import { LoadedCard } from './cards';
import CardsService from '../services/cards';

export default class Modal extends Service {
  @inject declare cards: CardsService;

  @tracked isShowing = false;

  @tracked state?: {
    format: Format;
    url: string;
    loadedCard: LoadedCard;
    resolve: Function;
    reject: Function;
  };

  get cardComponent(): unknown {
    return this.state?.loadedCard.component;
  }

  @task openWithCard = taskFor(
    async (url: string, format: Format): Promise<any> => {
      this.isShowing = true;

      let loadedCard = await this.cards.load(url, format);

      this.state = {
        loadedCard,
        format,
        url,
        resolve() {}, // Stub
        reject() {}, // stub
      };

      let promise = new Promise((resolve, reject) => {
        if (!this.state) {
          throw new Error('what');
        }

        this.state.resolve = resolve;
        this.state.reject = reject;
      });

      return promise;
    }
  );

  @action async save(): Promise<void> {
    if (!this.state) {
      return;
    }
    let model = await this.cards.save(
      this.state.url,
      this.state.loadedCard.data
    );
    this.state.resolve(model);
    this.close();
  }

  @action close(): void {
    this.isShowing = false;
    this.state = undefined;
  }
}
