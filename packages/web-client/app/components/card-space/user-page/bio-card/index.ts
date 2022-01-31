import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import CardSpaceUserData from '@cardstack/web-client/services/card-space-user-data';
import { processJsonApiErrors } from '@cardstack/web-client/utils/json-api';
import * as Sentry from '@sentry/browser';
import { CARD_EDIT_MODAL_STATES } from '../card-edit-modal';

const UNKNOWN_CARD_SPACE_BIO_ERROR = 'ERROR_SAVING_CARDSPACE_BIO';
const CARD_SPACE_BIO_VALIDATION = 'CARD_SPACE_BIO_VALIDATION';
const managedAttributes = ['bioTitle', 'bioDescription'] as const;
type ManagedAttribute = typeof managedAttributes[number];
export default class UserPageBioCardComponent extends Component {
  @service declare cardSpaceUserData: CardSpaceUserData;
  @tracked
  editingState: typeof CARD_EDIT_MODAL_STATES[keyof typeof CARD_EDIT_MODAL_STATES] =
    CARD_EDIT_MODAL_STATES.CLOSED;
  @tracked submissionErrorMessage = '';
  @tracked bioTitleInputValue = '';
  @tracked bioDescriptionInputValue = '';
  @tracked validationErrorMessages: Record<ManagedAttribute, string> = {
    bioTitle: '',
    bioDescription: '',
  };
  @tracked bioDescriptionInputValidationErrorMessage = '';

  get showInViewMode() {
    return (
      this.cardSpaceUserData.currentUserData.bioTitle ||
      this.cardSpaceUserData.currentUserData.bioDescription
    );
  }

  get bioTitle() {
    return this.cardSpaceUserData.currentUserData.bioTitle;
  }

  get bioDescription() {
    return this.cardSpaceUserData.currentUserData.bioDescription;
  }

  @action startEditing() {
    this.onBioDescriptionInput(this.bioDescription || '');
    this.onBioTitleInput(this.bioTitle || '');
    this.editingState = CARD_EDIT_MODAL_STATES.EDITING;
  }

  @action onBioTitleInput(value: string) {
    // this may need to be removed when we have client side validations
    this.validationErrorMessages.bioTitle = '';
    // eslint-disable-next-line no-self-assign
    this.validationErrorMessages = this.validationErrorMessages;
    this.bioTitleInputValue = value;
  }

  @action onBioDescriptionInput(value: string) {
    // this may need to be removed when we have client side validations
    this.validationErrorMessages.bioDescription = '';
    // eslint-disable-next-line no-self-assign
    this.validationErrorMessages = this.validationErrorMessages;
    this.bioDescriptionInputValue = value;
  }

  @action async save() {
    let extraErrors: any = [];
    let extraValidations: any = {};
    try {
      this.submissionErrorMessage = '';
      this.editingState = CARD_EDIT_MODAL_STATES.SUBMITTING;
      let response = await this.cardSpaceUserData.put({
        bioTitle: this.bioTitleInputValue,
        bioDescription: this.bioDescriptionInputValue,
      });
      if (response.errors) {
        let { validations, nonValidationErrors } = processJsonApiErrors(
          response.errors
        );
        extraValidations = validations;
        extraErrors = nonValidationErrors;

        if (nonValidationErrors.length) {
          throw new Error(UNKNOWN_CARD_SPACE_BIO_ERROR);
        }

        if (Object.keys(validations).length) {
          for (let attribute in validations) {
            if (managedAttributes.includes(attribute as ManagedAttribute)) {
              this.validationErrorMessages[attribute as ManagedAttribute] =
                validations[attribute].join(', ');
            } else {
              // Some other part of the PUT was invalid
              throw new Error(UNKNOWN_CARD_SPACE_BIO_ERROR);
            }
          }
          // eslint-disable-next-line no-self-assign
          this.validationErrorMessages = this.validationErrorMessages;

          throw new Error(CARD_SPACE_BIO_VALIDATION);
        }
        this.editingState = CARD_EDIT_MODAL_STATES.EDITING;
      } else {
        this.editingState = CARD_EDIT_MODAL_STATES.CLOSED;
      }
    } catch (e) {
      if (e.message !== CARD_SPACE_BIO_VALIDATION) {
        Sentry.setExtra('validations', extraValidations);
        Sentry.setExtra('errors', extraErrors);
        Sentry.captureException(e);
        console.error(e);
        // This is probably not enough and we may need some specific markup (links)
        this.submissionErrorMessage =
          'Failed to save your data. Press Save to try again.';
      }
      this.editingState = CARD_EDIT_MODAL_STATES.EDITING;
    }
  }

  @action stopEditing() {
    this.bioDescriptionInputValue = '';
    this.bioTitleInputValue = '';
    this.editingState = CARD_EDIT_MODAL_STATES.CLOSED;
  }
}
