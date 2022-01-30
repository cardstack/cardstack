import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action, set } from '@ember/object';
import { inject as service } from '@ember/service';
import CardSpaceUserData from '@cardstack/web-client/services/card-space-user-data';
import { A } from '@ember/array';
import * as Sentry from '@sentry/browser';
import { processJsonApiErrors } from '@cardstack/web-client/utils/json-api';

const UNKNOWN_CARD_SPACE_LINKS_ERROR = 'ERROR_SAVING_CARDSPACE_LINKS';
const CARD_SPACE_LINKS_VALIDATION = 'CARD_SPACE_LINKS_VALIDATION';
const CardStates = {
  DEFAULT: 'default',
  EDITING: 'editing',
  SUBMITTING: 'submitting',
} as const;

class TrackedLink {
  @tracked title = '';
  @tracked url = '';
  @tracked titleValidationError = '';
  @tracked urlValidationError = '';

  constructor(source?: { title: string; url: string }) {
    if (source) {
      this.title = source.title;
      this.url = source.url;
    }
  }

  @action updateTitle(title: string) {
    this.titleValidationError = '';
    this.title = title;
  }

  @action updateUrl(url: string) {
    this.urlValidationError = '';
    this.url = url;
  }
}

export default class UserPageLinksCardComponent extends Component {
  @service declare cardSpaceUserData: CardSpaceUserData;
  @tracked state: typeof CardStates[keyof typeof CardStates] =
    CardStates.DEFAULT;
  @tracked editedLinks: TrackedLink[] = A([]);
  @tracked submissionErrorMessage = '';

  get showInViewMode() {
    return this.cardSpaceUserData.currentUserData.links.length;
  }

  get links() {
    return this.cardSpaceUserData.currentUserData.links;
  }

  get isSubmitting() {
    return this.state === CardStates.SUBMITTING;
  }

  get isEditing() {
    return (
      this.state === CardStates.EDITING || this.state === CardStates.SUBMITTING
    );
  }

  @action addItem() {
    this.editedLinks.pushObject(new TrackedLink());
  }

  @action removeItemAt(index: number) {
    this.editedLinks.removeAt(index);
  }

  @action onClickEdit() {
    this.state = CardStates.EDITING;
    this.editedLinks = this.links.length
      ? A(this.links.map((source) => new TrackedLink(source)))
      : A([new TrackedLink()]);
  }

  @action async save() {
    let extraErrors: any = [];
    let extraValidations: any = {};
    let hasUnmanagedValidationError = false; // is there something we PUT that is not managed by this component?
    try {
      this.submissionErrorMessage = '';
      this.state = CardStates.SUBMITTING;
      let response = await this.cardSpaceUserData.put({
        links: this.editedLinks,
      });
      if (response.errors) {
        let { validations, nonValidationErrors } = processJsonApiErrors(
          response.errors
        );
        extraValidations = validations;
        extraErrors = nonValidationErrors;

        if (nonValidationErrors.length) {
          throw new Error(UNKNOWN_CARD_SPACE_LINKS_ERROR);
        }

        if (Object.keys(validations).length) {
          for (let attribute in validations) {
            if (attribute.startsWith('links.')) {
              try {
                set(
                  this,
                  (attribute.replace(/^links/, 'editedLinks') +
                    'ValidationError') as any,
                  validations[attribute].join(', ')
                );
              } catch (e) {
                throw new Error(UNKNOWN_CARD_SPACE_LINKS_ERROR);
              }
            } else {
              hasUnmanagedValidationError = true;
            }
          }

          throw new Error(CARD_SPACE_LINKS_VALIDATION);
        }
        this.state = CardStates.EDITING;
      } else {
        this.state = CardStates.DEFAULT;
      }
    } catch (e) {
      if (
        e.message !== CARD_SPACE_LINKS_VALIDATION ||
        hasUnmanagedValidationError
      ) {
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
    this.state = CardStates.DEFAULT;
    this.editedLinks = A([]);
  }
}
