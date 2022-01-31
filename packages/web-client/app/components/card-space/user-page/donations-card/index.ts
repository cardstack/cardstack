import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import CardSpaceUserData from '@cardstack/web-client/services/card-space-user-data';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import * as Sentry from '@sentry/browser';
import { processJsonApiErrors } from '@cardstack/web-client/utils/json-api';

const UNKNOWN_CARD_SPACE_DONATIONS_ERROR = 'ERROR_SAVING_CARDSPACE_DONATIONS';
const CARD_SPACE_DONATIONS_VALIDATION = 'CARD_SPACE_DONATIONS_VALIDATION';
const CardStates = {
  DEFAULT: 'default',
  EDITING: 'editing',
  SUBMITTING: 'submitting',
} as const;
const managedAttributes = [
  'donationDescription',
  'donationTitle',
  'donationSuggestionAmount1',
  'donationSuggestionAmount2',
  'donationSuggestionAmount3',
  'donationSuggestionAmount4',
] as const;
type ManagedAttribute = typeof managedAttributes[number];
// for the payments to work, this needs to be able to get the network (needs extending of layer 2 strategy type with `networkSymbol: string`)
// it also needs a way to open a popup (maybe in-element, with the element at the top of the user-page component)
// and also a way to get a merchant's address using their ID
// the merchant payment URLs can be generated with the generateMerchantPaymentUrl utility from the SDK
export default class UserPageDonationsCardComponent extends Component {
  @service declare cardSpaceUserData: CardSpaceUserData;
  @service declare layer2Network: Layer2Network;

  @tracked state: typeof CardStates[keyof typeof CardStates] =
    CardStates.DEFAULT;
  @tracked submissionErrorMessage = '';
  @tracked donationDescriptionInputValue = '';
  @tracked donationTitleInputValue = '';
  @tracked donationSuggestionAmount1InputValue = '';
  @tracked donationSuggestionAmount2InputValue = '';
  @tracked donationSuggestionAmount3InputValue = '';
  @tracked donationSuggestionAmount4InputValue = '';
  @tracked validationErrorMessages: Record<ManagedAttribute, string> = {
    donationDescription: '',
    donationTitle: '',
    donationSuggestionAmount1: '',
    donationSuggestionAmount2: '',
    donationSuggestionAmount3: '',
    donationSuggestionAmount4: '',
  };

  get showInViewMode() {
    const {
      donationDescription,
      donationTitle,
      donationSuggestionAmount1,
      donationSuggestionAmount2,
      donationSuggestionAmount3,
      donationSuggestionAmount4,
    } = this;

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

  get donationSuggestionAmount1() {
    return this.cardSpaceUserData.currentUserData.donationSuggestionAmount1;
  }

  get donationSuggestionAmount2() {
    return this.cardSpaceUserData.currentUserData.donationSuggestionAmount2;
  }

  get donationSuggestionAmount3() {
    return this.cardSpaceUserData.currentUserData.donationSuggestionAmount3;
  }

  get donationSuggestionAmount4() {
    return this.cardSpaceUserData.currentUserData.donationSuggestionAmount4;
  }

  @action onDonationDescriptionInput(value: string) {
    this.donationDescriptionInputValue = value;
  }
  @action onDonationTitleInput(value: string) {
    this.donationTitleInputValue = value;
  }
  @action onDonationSuggestionAmount1Input(value: string) {
    if (/[^0-9]/.test(value)) {
      this.donationSuggestionAmount1InputValue =
        // eslint-disable-next-line no-self-assign
        this.donationSuggestionAmount1InputValue;
    } else {
      this.donationSuggestionAmount1InputValue = value;
    }
  }
  @action onDonationSuggestionAmount2Input(value: string) {
    if (/[^0-9]/.test(value)) {
      this.donationSuggestionAmount2InputValue =
        // eslint-disable-next-line no-self-assign
        this.donationSuggestionAmount2InputValue;
    } else {
      this.donationSuggestionAmount2InputValue = value;
    }
  }
  @action onDonationSuggestionAmount3Input(value: string) {
    if (/[^0-9]/.test(value)) {
      this.donationSuggestionAmount3InputValue =
        // eslint-disable-next-line no-self-assign
        this.donationSuggestionAmount3InputValue;
    } else {
      this.donationSuggestionAmount3InputValue = value;
    }
  }
  @action onDonationSuggestionAmount4Input(value: string) {
    if (/[^0-9]/.test(value)) {
      this.donationSuggestionAmount4InputValue =
        // eslint-disable-next-line no-self-assign
        this.donationSuggestionAmount4InputValue;
    } else {
      this.donationSuggestionAmount4InputValue = value;
    }
  }

  get donationSuggestionAmountList() {
    return [
      this.donationSuggestionAmount1,
      this.donationSuggestionAmount2,
      this.donationSuggestionAmount3,
      this.donationSuggestionAmount4,
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
    this.donationDescriptionInputValue = this.donationDescription ?? '';
    this.donationTitleInputValue = this.donationTitle ?? '';
    this.donationSuggestionAmount1InputValue = `${this.donationSuggestionAmount1}`;
    this.donationSuggestionAmount2InputValue = `${this.donationSuggestionAmount2}`;
    this.donationSuggestionAmount3InputValue = `${this.donationSuggestionAmount3}`;
    this.donationSuggestionAmount4InputValue = `${this.donationSuggestionAmount4}`;
  }

  @action async save() {
    let extraErrors: any = [];
    let extraValidations: any = {};
    try {
      this.submissionErrorMessage = '';
      this.state = CardStates.SUBMITTING;
      let response = await this.cardSpaceUserData.put({
        donationDescription: this.donationDescriptionInputValue,
        donationTitle: this.donationTitleInputValue,
        donationSuggestionAmount1: Number(
          this.donationSuggestionAmount1InputValue
        ),
        donationSuggestionAmount2: Number(
          this.donationSuggestionAmount2InputValue
        ),
        donationSuggestionAmount3: Number(
          this.donationSuggestionAmount3InputValue
        ),
        donationSuggestionAmount4: Number(
          this.donationSuggestionAmount4InputValue
        ),
      });
      if (response.errors) {
        let { validations, nonValidationErrors } = processJsonApiErrors(
          response.errors
        );
        extraValidations = validations;
        extraErrors = nonValidationErrors;

        if (nonValidationErrors.length) {
          throw new Error(UNKNOWN_CARD_SPACE_DONATIONS_ERROR);
        }

        if (Object.keys(validations).length) {
          for (let attribute in validations) {
            if (managedAttributes.includes(attribute as ManagedAttribute)) {
              this.validationErrorMessages[attribute as ManagedAttribute] =
                validations[attribute].join(', ');
            } else {
              throw new Error(UNKNOWN_CARD_SPACE_DONATIONS_ERROR);
            }
          }
          // eslint-disable-next-line no-self-assign
          this.validationErrorMessages = this.validationErrorMessages;

          throw new Error(CARD_SPACE_DONATIONS_VALIDATION);
        }
        this.state = CardStates.EDITING;
      } else {
        this.state = CardStates.DEFAULT;
      }
    } catch (e) {
      if (e.message !== CARD_SPACE_DONATIONS_VALIDATION) {
        Sentry.setExtra('validations', extraValidations);
        Sentry.setExtra('errors', extraErrors);
        Sentry.captureException(e);
        console.error(e);
        // This is probably not enough and we may need some specific markup (links)
        this.submissionErrorMessage =
          'Failed to save your data. Press Save to try again.';
      }
      this.state = CardStates.EDITING;
    }
  }

  @action onEndEdit() {
    this.donationDescriptionInputValue = '';
    this.donationTitleInputValue = '';
    this.donationSuggestionAmount1InputValue = '';
    this.donationSuggestionAmount2InputValue = '';
    this.donationSuggestionAmount3InputValue = '';
    this.donationSuggestionAmount4InputValue = '';
    this.state = CardStates.DEFAULT;
  }
}
