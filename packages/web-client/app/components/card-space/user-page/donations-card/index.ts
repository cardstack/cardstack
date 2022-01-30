import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import CardSpaceUserData from '@cardstack/web-client/services/card-space-user-data';
import Layer2Network from '@cardstack/web-client/services/layer2-network';

const CardStates = {
  DEFAULT: 'default',
  EDITING: 'editing',
  SUBMITTING: 'submitting',
} as const;

// for the payments to work, this needs to be able to get the network (needs extending of layer 2 strategy type with `networkSymbol: string`)
// it also needs a way to open a popup (maybe in-element, with the element at the top of the user-page component)
// and also a way to get a merchant's address using their ID
// the merchant payment URLs can be generated with the generateMerchantPaymentUrl utility from the SDK
export default class UserPageDonationsCardComponent extends Component {
  @service declare cardSpaceUserData: CardSpaceUserData;
  @service declare layer2Network: Layer2Network;

  @tracked state: typeof CardStates[keyof typeof CardStates] =
    CardStates.DEFAULT;

  get showInViewMode() {
    const {
      donationDescription,
      donationTitle,
      donationSuggestionAmount1,
      donationSuggestionAmount2,
      donationSuggestionAmount3,
      donationSuggestionAmount4,
    } = this.cardSpaceUserData.currentUserData;

    return (
      donationDescription ||
      donationTitle ||
      donationSuggestionAmount1 ||
      donationSuggestionAmount2 ||
      donationSuggestionAmount3 ||
      donationSuggestionAmount4
    );
  }

  get displayName() {
    return this.cardSpaceUserData.currentUserData.profileName;
  }

  get donationDescription() {
    return this.cardSpaceUserData.currentUserData.donationDescription;
  }

  get donationTitle() {
    return this.cardSpaceUserData.currentUserData.donationTitle;
  }

  get donationSuggestionAmountList() {
    return [
      this.cardSpaceUserData.currentUserData.donationSuggestionAmount1,
      this.cardSpaceUserData.currentUserData.donationSuggestionAmount2,
      this.cardSpaceUserData.currentUserData.donationSuggestionAmount3,
      this.cardSpaceUserData.currentUserData.donationSuggestionAmount4,
    ].filter((v) => v);
  }

  get isSubmitting() {
    return this.state === CardStates.SUBMITTING;
  }

  get isEditing() {
    return (
      this.state === CardStates.EDITING || this.state === CardStates.SUBMITTING
    );
  }

  @action onClickEdit() {
    this.state = CardStates.EDITING;
  }

  @action async save() {
    try {
      this.state = CardStates.SUBMITTING;
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      this.state = CardStates.DEFAULT;
    } catch (e) {
      this.state = CardStates.EDITING;
    }
  }

  @action onEndEdit() {
    this.state = CardStates.DEFAULT;
  }
}
