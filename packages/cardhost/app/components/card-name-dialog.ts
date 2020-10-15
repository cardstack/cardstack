import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import { tracked } from '@glimmer/tracking';
//@ts-ignore
import { task } from 'ember-concurrency';
import { cardDocument } from '@cardstack/hub';
import { getUserRealm } from '../utils/scaffolding';
import { AddressableCard } from '@cardstack/hub';
import DataService from '../services/data';
import OverlaysService from '../services/overlays';
import CardLocalStorageService from '../services/card-local-storage';
//@ts-ignore
import ENV from '@cardstack/cardhost/config/environment';

const { deviceCardsOnly } = ENV;

export default class CardNameDialog extends Component<{
  title: string;
  mode: string;
  icon: string;
  adoptsFrom: AddressableCard;
  closeDialog: () => void;
}> {
  @service router!: RouterService;
  @service data!: DataService;
  @service overlays!: OverlaysService;
  @service cardLocalStorage!: CardLocalStorageService;

  @tracked name?: string;

  get title() {
    return this.args.title || 'Create a New Card';
  }

  willDestroy() {
    if (this.args.closeDialog) {
      this.args.closeDialog();
    }
  }

  @action
  updateCardName(name: string) {
    this.name = name;
  }

  @action
  keyDown(event: KeyboardEvent) {
    if (event.which === 13) {
      this.createCard();
    } else if (event.which === 27 && this.args.closeDialog) {
      this.args.closeDialog();
    }
  }

  @task(function*(this: CardNameDialog) {
    let csCreatedBy = '';
    if (deviceCardsOnly) {
      // If the app is configured to only show recent cards in the library, save the new id to local storage
      csCreatedBy = this.cardLocalStorage.getDevice();
    }

    let doc = cardDocument().withAttributes({
      csTitle: this.name,
      csCreatedBy,
    });
    if (this.args.adoptsFrom) {
      doc.adoptingFrom(this.args.adoptsFrom);
      let csFieldOrder = Array.isArray(this.args.adoptsFrom.csFieldOrder)
        ? [...this.args.adoptsFrom.csFieldOrder]
        : undefined;
      if (csFieldOrder) {
        doc.withAttributes({ csFieldOrder });
      }
    }

    let unsavedCard = yield this.data.create(getUserRealm(), doc.jsonapi);
    let card = yield this.data.save(unsavedCard);

    if (this.args.adoptsFrom) {
      this.router.transitionTo('cards.card.view.edit', { card });
    } else {
      this.router.transitionTo('cards.card.configure.fields', { card });
    }
  })
  createCardTask: any;

  @action
  createCard() {
    this.createCardTask.perform();
  }
}
