import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import CardModel from '@cardstack/core/src/card-model';
import { taskFor, TaskFunction } from 'ember-concurrency-ts';
import { timeout } from 'ember-concurrency';

interface CardChooserArgs {
  type?: string;
  onFetchCardsTask: TaskFunction;
  selected: CardModel;
  onChange: (card: CardModel) => void;
}

export default class CardChooserComponent extends Component<CardChooserArgs> {
  @tracked isLoading = false;
  @tracked isOpen = false;
  @tracked selectableCards: CardModel[] = [];

  @action async openCardOptions(): Promise<void> {
    this.isLoading = true;
    await timeout(500);
    let task = taskFor(this.args.onFetchCardsTask);
    let results = await task.perform();
    this.selectableCards = results;
    this.isLoading = false;
    this.isOpen = true;
  }

  @action chooseCard(card: CardModel): void {
    this.isOpen = false;
    this.args.onChange(card);
  }
}
