import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import ProfileService from '@cardstack/web-client/services/profile';
import { inject as service } from '@ember/service';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { didCancel, restartableTask, timeout } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { mostReadable, random as randomColor } from '@ctrl/tinycolor';
import config from '@cardstack/web-client/config/environment';
import { validateMerchantId } from '@cardstack/cardpay-sdk';
import * as Sentry from '@sentry/browser';
import { isPresent } from '@ember/utils';

const randomColorOptions = config.environment === 'test' ? { seed: 1 } : {};

export default class CardPayCreateProfileWorkflowProfileCustomizationComponent extends Component<WorkflowCardComponentArgs> {
  @service declare layer2Network: Layer2Network;
  @service declare profile: ProfileService;

  @tracked profileBgColor: string =
    randomColor(randomColorOptions).toHexString();
  @tracked profileName: string = '';
  @tracked profileSlug: string = '';
  @tracked lastCheckedProfileSlug = '';
  @tracked lastCheckedProfileSlugValid = false;
  @tracked profileNameValidationMessage = '';
  @tracked profileSlugValidationMessage = '';
  @tracked profileBgColorValidationMessage = '';

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    let { workflowSession } = this.args;
    let profileName = workflowSession.getValue<string>('profileName');
    let profileSlug = workflowSession.getValue<string>('profileSlug');
    let profileBgColor = workflowSession.getValue<string>('profileBgColor');

    if (
      isPresent(profileName) &&
      isPresent(profileSlug) &&
      isPresent(profileBgColor)
    ) {
      this.profileName = profileName!;
      this.profileBgColor = profileBgColor!;
      this.profileSlug = profileSlug!;
      this.validateProfileSlug(); // this is necessary for enabling the CTA
    }
  }

  get canSaveDetails() {
    return this.allFieldsPopulated && this.noValidationErrors;
  }

  get allFieldsPopulated() {
    if (this.profileBgColor && this.profileName && this.profileSlug) {
      return true;
    }
    return false;
  }

  get noValidationErrors() {
    return (
      this.profileSlugInputState === 'valid' &&
      !this.profileNameValidationMessage &&
      !this.profileBgColorValidationMessage
    );
  }

  get profileSlugInputState() {
    if (taskFor(this.validateProfileSlugTask).isRunning) {
      return 'loading';
    } else if (
      this.lastCheckedProfileSlug === this.profileSlug &&
      this.lastCheckedProfileSlugValid
    ) {
      return 'valid';
    } else if (this.profileSlugValidationMessage) {
      return 'invalid';
    } else {
      return 'initial';
    }
  }

  // We might want to do some whitespace collapsing before saving?
  get trimmedProfileName() {
    return this.profileName.trim();
  }

  get profileTextColor() {
    return mostReadable(this.profileBgColor, [
      '#ffffff',
      '#000000',
    ])!.toHexString();
  }

  @action onProfileNameInput(value: string) {
    this.profileName = value;
    this.validateProfileName();
  }

  @action onProfileSlugInput(value: string) {
    this.profileSlug = value;
    this.validateProfileSlug();
  }

  @action onProfileBgColorInput(event: InputEvent) {
    let value = (event.target as HTMLInputElement).value;
    this.profileBgColor = value;
  }

  @action saveDetails() {
    let valuesToStore = {
      profileName: this.trimmedProfileName,
      profileSlug: this.profileSlug,
      profileBgColor: this.profileBgColor,
      profileTextColor: this.profileTextColor,
    };
    let { workflowSession } = this.args;
    let profileHasBeenPersisted = !!workflowSession.getValue('profile');

    if (profileHasBeenPersisted) {
      let detailsHaveChangedSincePersistence =
        workflowSession.getValue('profileName') !== valuesToStore.profileName ||
        workflowSession.getValue('profileSlug') !== valuesToStore.profileSlug ||
        workflowSession.getValue('profileBgColor') !==
          valuesToStore.profileBgColor ||
        workflowSession.getValue('profileTextColor') !==
          valuesToStore.profileTextColor;

      if (detailsHaveChangedSincePersistence) {
        workflowSession.delete('profile');
      }
    }

    this.args.workflowSession.setValue(valuesToStore);
    this.args.onComplete?.();
  }

  @action validateProfileName() {
    let message: string = '';
    if (!this.trimmedProfileName.length) {
      message = 'This field is required';
    } else if (this.trimmedProfileName.length > 50) {
      message = 'Cannot exceed 50 characters';
    }
    this.profileNameValidationMessage = message;
  }

  @action async validateProfileSlug(earlyReturnForBlur = false) {
    if (earlyReturnForBlur) {
      if (!this.profileSlug) {
        // we know it's invalid if there's no profile id, so we don't need the previous task to keep running
        taskFor(this.validateProfileSlugTask).cancelAll();
        this.profileSlugValidationMessage = 'This field is required';
        this.lastCheckedProfileSlug = '';
        this.lastCheckedProfileSlugValid = false;
      }
      // if there is a profile id, blur validation is a no-op
      // let the last validation task from input continue if it needs to
      // otherwise we keep the current state
      return;
    }

    try {
      await taskFor(this.validateProfileSlugTask).perform();
    } catch (e) {
      if (didCancel(e)) {
        return;
      }
      console.error(e);
    }
  }

  @restartableTask *validateProfileSlugTask() {
    // debounce
    yield timeout(config.environment === 'test' ? 10 : 500);
    let value = this.profileSlug;

    this.profileSlugValidationMessage = validateMerchantId(value);

    if (this.profileSlugValidationMessage) {
      this.lastCheckedProfileSlugValid = false;
      return;
    }

    try {
      let { slugAvailable, detail } = yield taskFor(
        this.profile.checkProfileSlugUniquenessTask
      ).perform({ slug: value });

      this.lastCheckedProfileSlug = value;
      if (!slugAvailable) {
        this.profileSlugValidationMessage = detail;
        this.lastCheckedProfileSlugValid = false;
        return;
      }

      this.profileSlugValidationMessage = '';
      this.lastCheckedProfileSlugValid = true;
      return;
    } catch (e) {
      console.error('Error validating uniqueness', e);
      Sentry.captureException(e);

      this.profileSlugValidationMessage =
        'There was an error validating profile ID uniqueness';
      this.lastCheckedProfileSlug = '';
      this.lastCheckedProfileSlugValid = false;

      if (e.message.startsWith('No valid auth token')) {
        let { workflowSession } = this.args;
        workflowSession?.workflow?.cancel('UNAUTHENTICATED');
        throw new Error('UNAUTHENTICATED');
      }
      return;
    }
  }
}
