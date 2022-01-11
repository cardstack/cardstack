import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { restartableTask, timeout } from 'ember-concurrency';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import config from '@cardstack/web-client/config/environment';
import { taskFor } from 'ember-concurrency-ts';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { inject as service } from '@ember/service';
import * as Sentry from '@sentry/browser';
import { InputValidationState } from '@cardstack/web-client/components/common/validation-state-input';

export const OPTIONS = [
  'Music',
  'Health',
  'Gaming',
  'Education',
  'Fashion',
  'Writing',
  'Other',
];

class CardSpaceEditDetailsCategoryComponent extends Component<WorkflowCardComponentArgs> {
  otherRadioValue = 'other';

  @service declare hubAuthentication: HubAuthentication;

  @tracked otherValue: string = '';
  @tracked categoryValidationState: InputValidationState = 'initial';
  @tracked categoryValidationMessage: string = '';
  @tracked otherIsChecked = false;

  options = OPTIONS;

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);

    if (this.categoryValue && !OPTIONS.includes(this.categoryValue)) {
      this.otherIsChecked = true;
      this.otherValue = this.categoryValue;
    }
  }

  get categoryValue() {
    return this.args.workflowSession.getValue<string>('profileCategory');
  }

  @action setCategoryValue(val: string) {
    if (val === this.otherRadioValue) {
      this.otherIsChecked = true;
      taskFor(this.validateCategoryTask).perform(this.otherValue);
    } else {
      this.otherIsChecked = false;
      this.args.workflowSession.setValue('profileCategory', val);
    }
  }

  @action setupOtherValueInput(element: HTMLElement) {
    let input = element!.querySelector('input')!;
    /**
     * We're assuming that browsers clean up event listeners by themselves. We do not have a closure
     * that references this input... so we shouldn't have a memory leak.
     */
    input.addEventListener('blur', () => {
      taskFor(this.validateCategoryTask).perform(this.otherValue);
    });
    input.focus();
  }

  @action onOtherValueInput(value: string) {
    this.otherValue = value;
    taskFor(this.validateCategoryTask).perform(value);
  }

  @restartableTask *validateCategoryTask(profileCategory: string): any {
    this.categoryValidationState = 'loading';

    yield timeout(config.environment === 'test' ? 10 : 500); // debounce

    try {
      let response = yield fetch(
        `${config.hubURL}/api/card-spaces/validate-profile-category`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + this.hubAuthentication.authToken,
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
          },
          body: JSON.stringify({
            data: { attributes: { 'profile-category': profileCategory } },
          }),
        }
      );

      let { errors } = yield response.json();

      if (!this.otherIsChecked) {
        return;
      }

      if (errors.length === 0) {
        this.categoryValidationState = 'valid';
        this.categoryValidationMessage = '';
        this.args.workflowSession.setValue('profileCategory', profileCategory);
      } else {
        this.categoryValidationState = 'invalid';
        this.categoryValidationMessage = errors[0].detail;
        this.args.workflowSession.delete('profileCategory');
      }
    } catch (e) {
      console.error('Error validating card space url', e);
      Sentry.captureException(e);
      this.args.workflowSession.delete('profileCategory');
      this.categoryValidationState = 'invalid';
      this.categoryValidationMessage =
        'There was an error validating your Card Space profile category. Please try again or contact support';
    }
  }
}

export default CardSpaceEditDetailsCategoryComponent;
