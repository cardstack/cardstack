import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { ImageUploadSuccessResult } from '@cardstack/web-client/components/image-uploader';
import config from '@cardstack/web-client/config/environment';
import { ImageValidation } from '@cardstack/web-client/utils/image';
import * as Sentry from '@sentry/browser';
import { task, TaskGenerator } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import CardSpaceUserData from '@cardstack/web-client/services/card-space-user-data';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { processJsonApiErrors } from '@cardstack/web-client/utils/json-api';

const UNKNOWN_CARD_SPACE_BACKGROUND_ERROR = 'CARD_SPACE_BACKGROUND_ERROR';
const CARD_SPACE_BACKGROUND_VALIDATION = 'CARD_SPACE_BACKGROUND_VALIDATION';

const CardStates = {
  DEFAULT: 'default',
  EDITING: 'editing',
  SUBMITTING: 'submitting',
} as const;

export const IMAGE_EDITOR_ELEMENT_ID = 'card-space-user-page-image-editor';
export default class UserPageBackgroundCardComponent extends Component {
  @service declare cardSpaceUserData: CardSpaceUserData;
  @service declare hubAuthentication: HubAuthentication;
  @tracked state: typeof CardStates[keyof typeof CardStates] =
    CardStates.DEFAULT;
  @tracked submissionErrorMessage = '';

  @tracked backgroundInputValue = '';
  imageEditorElement = document.getElementById(IMAGE_EDITOR_ELEMENT_ID);
  desiredWidth = 400;
  desiredHeight = 400;
  acceptedFileTypes = ['image/jpeg', 'image/png'];
  @tracked processedImage = {
    type: '',
    filename: '',
    preview: '',
  };
  @tracked showEditor = false;
  @tracked imageUploadErrorMessage = '';
  @tracked imageUploadState = 'valid';

  get imageValidation() {
    return new ImageValidation({
      fileType: this.acceptedFileTypes,
      maxFileSize: 1 * 1000 * 1000, // 1 MB
    });
  }

  @action async onUpload(image: ImageUploadSuccessResult): Promise<void> {
    let validationResult = await this.imageValidation.validate(image.file);

    if (!validationResult.valid) {
      this.imageUploadErrorMessage = validationResult.message;
      this.imageUploadState = 'error';
      return;
    }

    this.processImage(image);
  }

  processImage(image: ImageUploadSuccessResult) {
    this.processedImage = {
      type: image.file.type,
      filename: image.file.name,
      preview: image.preview,
    };
    this.showEditor = true;
    this.imageUploadErrorMessage = '';
  }

  @action onImageRemoved() {
    taskFor(this.saveImageEditDataTask).cancelAll();
    this.backgroundInputValue = '';
    this.imageUploadState = 'valid';
    this.imageUploadErrorMessage = '';
  }

  @task *saveImageEditDataTask(data: {
    preview: string;
    file: Blob;
  }): TaskGenerator<void> {
    try {
      this.backgroundInputValue = data.preview;
      let formdata = new FormData();

      formdata.append(
        this.processedImage.filename,
        data.file,
        this.processedImage.filename
      );

      this.imageUploadState = 'loading';
      let response = yield (yield fetch(`${config.hubURL}/upload`, {
        method: 'POST',
        body: formdata,
        headers: {
          Authorization: 'Bearer: ' + this.hubAuthentication.authToken,
        },
      })).json();

      if (response.data?.attributes?.url) {
        let url = response.data.attributes.url;
        this.backgroundInputValue = url;
        this.imageUploadState = 'valid';
      } else if (response.errors) {
        if (
          response.errors.length === 1 &&
          Number(response.errors[0].status) === 401 &&
          response.errors[0].title === 'No valid auth token'
        ) {
          console.error(
            'Failed to upload image to hub due to invalid auth token'
          );
          this.hubAuthentication.authToken = null;
          throw new Error('No valid auth token');
        }

        console.error(
          'Failed to upload image to hub. Errors:',
          response.errors
        );
        let error = new Error('Failed to upload image to hub');
        // @ts-ignore
        error.reasons = response.errors;
        throw error;
      } else {
        let error = new Error('Unexpected response uploading image to hub');
        // @ts-ignore
        error.details = response;
        throw error;
      }
    } catch (e) {
      console.error('Failed to upload file to hub', e);
      Sentry.captureException(e);
      this.backgroundInputValue = '';
      this.imageUploadState = 'error';
      this.imageUploadErrorMessage = 'Failed to upload file';
    } finally {
      this.processedImage = {
        type: '',
        filename: '',
        preview: '',
      };
    }
  }

  @action logUploadError(e: Error) {
    console.error('Failed to upload file to browser', e);
    Sentry.captureException(e);
  }

  get background() {
    return this.cardSpaceUserData.currentUserData.profileCoverImageUrl;
  }

  get isSubmitting() {
    return this.state === CardStates.SUBMITTING;
  }

  get isEditing() {
    return (
      this.state === CardStates.EDITING || this.state === CardStates.SUBMITTING
    );
  }

  get submissionDisabled() {
    return this.imageUploadState === 'loading';
  }

  @action onClickEdit() {
    this.state = CardStates.EDITING;
    this.imageUploadState = 'default';
    this.imageUploadErrorMessage = '';
    this.backgroundInputValue = this.background;
  }

  @action async save() {
    let extraErrors: any = [];
    let extraValidations: any = {};
    let hasUnmanagedValidationError = false; // is there something we PUT that is not managed by this component?
    this.submissionErrorMessage = '';
    try {
      this.state = CardStates.SUBMITTING;
      let response = await this.cardSpaceUserData.put({
        profileCoverImageUrl: this.backgroundInputValue,
      });
      this.state = CardStates.DEFAULT;

      if (response.errors) {
        let { validations, nonValidationErrors } = processJsonApiErrors(
          response.errors
        );
        extraValidations = validations;
        extraErrors = nonValidationErrors;

        if (nonValidationErrors.length) {
          throw new Error(UNKNOWN_CARD_SPACE_BACKGROUND_ERROR);
        }

        if (Object.keys(validations).length) {
          for (let attribute in validations) {
            if (attribute === 'profileCoverImageUrl') {
              this.imageUploadErrorMessage = validations[attribute].join(', ');
              this.imageUploadState = 'error';
            } else {
              hasUnmanagedValidationError = true;
            }
          }

          throw new Error(CARD_SPACE_BACKGROUND_VALIDATION);
        }
      }
    } catch (e) {
      if (
        e.message !== CARD_SPACE_BACKGROUND_VALIDATION ||
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
      // display error messages
      this.state = CardStates.EDITING;
    }
  }

  @action onEndEdit() {
    this.state = CardStates.DEFAULT;
  }
}
