import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import CardCustomization from '@cardstack/web-client/services/card-customization';
import { PrepaidCardSafe } from '@cardstack/cardpay-sdk';
import { taskFor } from 'ember-concurrency-ts';
import { TaskInstance } from 'ember-concurrency';

interface CardPayPrepaidCardSafeComponentArgs {
  safe: PrepaidCardSafe;
  waitForCustomization?: boolean;
}

export default class CardPayPrepaidCardSafeComponent extends Component<CardPayPrepaidCardSafeComponentArgs> {
  @service declare cardCustomization: CardCustomization;

  @tracked fetchTask: TaskInstance<any> | undefined;

  @action fetchCustomization() {
    if (this.args.safe.customizationDID) {
      this.fetchTask = taskFor(
        this.cardCustomization.fetchCardCustomization
      ).perform(
        this.args.safe.customizationDID,
        this.args.waitForCustomization
      );
    }
  }

  get customization() {
    return this.fetchTask?.value;
  }
}
