import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import CardCustomization from '@cardstack/web-client/services/card-customization';
import { PrepaidCardSafe } from '@cardstack/cardpay-sdk';
import { taskFor } from 'ember-concurrency-ts';

interface CardPayPrepaidCardSafeComponentArgs {
  safe: PrepaidCardSafe;
}

export default class CardPayPrepaidCardSafeComponent extends Component<CardPayPrepaidCardSafeComponentArgs> {
  @service declare cardCustomization: CardCustomization;

  @tracked fetchTask;

  @action fetchCustomization() {
    if (this.args.safe.customizationDID) {
      this.fetchTask = taskFor(
        this.cardCustomization.fetchCardCustomization
      ).perform(this.args.safe.customizationDID);

      if (this.args.safe.customizationDID !== 'did:jortle') {
        window.ft = this.fetchTask;
      }
    }
  }

  get customization() {
    return this.fetchTask?.value;
  }
}
