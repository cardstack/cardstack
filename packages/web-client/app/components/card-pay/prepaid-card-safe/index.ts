import Component from '@glimmer/component';
import { inject as service } from '@ember/service';

import CardCustomization from '@cardstack/web-client/services/card-customization';
import { PrepaidCardSafe } from '@cardstack/cardpay-sdk';
import { taskFor } from 'ember-concurrency-ts';
import { useTask } from 'ember-resources';

interface CardPayPrepaidCardSafeComponentArgs {
  safe: PrepaidCardSafe;
  waitForCustomization?: boolean;
}

export default class CardPayPrepaidCardSafeComponent extends Component<CardPayPrepaidCardSafeComponentArgs> {
  @service declare cardCustomization: CardCustomization;
  fetchTask: any;

  constructor(owner: unknown, args: CardPayPrepaidCardSafeComponentArgs) {
    super(owner, args);

    // This is inside the constructor because the service needs to be initialised
    this.fetchTask = useTask(
      this,
      taskFor(this.cardCustomization.fetchCardCustomization),
      () => [this.args.safe.customizationDID, this.args.waitForCustomization]
    );
  }

  get customization() {
    return this.fetchTask?.value;
  }
}
