import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import CardSpaceUserData from '@cardstack/web-client/services/card-space-user-data';

const CardStates = {
  DEFAULT: 'default',
  EDITING: 'editing',
  SUBMITTING: 'submitting',
} as const;

export default class UserPageBioCardComponent extends Component {
  @service declare cardSpaceUserData: CardSpaceUserData;
  @tracked state: typeof CardStates[keyof typeof CardStates] =
    CardStates.DEFAULT;
  @tracked bioTitleInputValue = '';
  @tracked bioDescriptionInputValue = '';

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

  get isSubmitting() {
    return this.state === CardStates.SUBMITTING;
  }

  get isEditing() {
    return (
      this.state === CardStates.EDITING || this.state === CardStates.SUBMITTING
    );
  }

  @action onClickEdit() {
    this.bioDescriptionInputValue = this.bioDescription || '';
    this.bioTitleInputValue = this.bioTitle || '';
    this.state = CardStates.EDITING;
  }

  @action onBioTitleInput(value: string) {
    this.bioTitleInputValue = value;
  }
  @action onBioDescriptionInput(value: string) {
    this.bioDescriptionInputValue = value;
  }

  @action async save() {
    try {
      this.state = CardStates.SUBMITTING;
      await this.cardSpaceUserData.post({
        bioTitle: this.bioTitleInputValue,
        bioDescription: this.bioDescriptionInputValue,
      });
      this.state = CardStates.DEFAULT;

      // JSON API error detection
    } catch (e) {
      // display error message
      this.state = CardStates.EDITING;
    }
  }

  @action onEndEdit() {
    this.bioDescriptionInputValue = '';
    this.bioTitleInputValue = '';
    this.state = CardStates.DEFAULT;
  }
}
