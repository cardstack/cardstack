import { InputValidationState } from '@cardstack/boxel/addon/components/boxel/input/validation-state';
import { ImageUploadSuccessResult } from '@cardstack/web-client/components/image-uploader';
import config from '@cardstack/web-client/config/environment';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { ImageValidation } from '@cardstack/web-client/utils/image';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import * as Sentry from '@sentry/browser';
import {
  restartableTask,
  task,
  TaskGenerator,
  timeout,
} from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';

export const IMAGE_EDITOR_ELEMENT_ID = 'card-space-image-editor';
export default class UsernameComponent extends Component<WorkflowCardComponentArgs> {
  @service('hub-authentication') declare hubAuthentication: HubAuthentication;

  imageEditorElement = document.getElementById(IMAGE_EDITOR_ELEMENT_ID);
  desiredWidth = 400;
  desiredHeight = 400;
  acceptedFileTypes = ['image/jpeg', 'image/png'];
  @tracked username = '';
  @tracked usernameInputState: InputValidationState = 'initial';
  @tracked usernameInputErrorMessage = '';
  @tracked profileImage = '';
  @tracked processedImage = {
    type: '',
    filename: '',
    preview: '',
  };
  @tracked showEditor = false;
  @tracked imageUploadErrorMessage = '';
  @tracked imageUploadState = 'valid';

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    this.profileImage =
      this.args.workflowSession.getValue<string>('profileImageUrl') ?? '';
    let username = this.args.workflowSession.getValue<string>('username');
    this.username = username ?? '';
    if (!this.args.isComplete && username) {
      taskFor(this.updateUsernameTask).perform(username);
    }
  }

  get disableCompletion() {
    return !this.args.isComplete && this.usernameInputState !== 'valid';
  }

  get imageValidation() {
    return new ImageValidation({
      fileType: this.acceptedFileTypes,
      maxFileSize: 1 * 1000 * 1000, // 1 MB
    });
  }

  @restartableTask *updateUsernameTask(username: string): any {
    this.usernameInputState = 'loading';

    yield timeout(config.environment === 'test' ? 10 : 500); // debounce

    try {
      let response = yield fetch(
        `${config.hubURL}/api/card-spaces/validate-profile-name`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + this.hubAuthentication.authToken,
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
          },
          body: JSON.stringify({
            data: { attributes: { 'profile-name': username } },
          }),
        }
      );
      let { errors } = yield response.json();

      if (errors.length === 0) {
        this.username = username;
        this.args.workflowSession.setValue('username', username);
        this.usernameInputState = 'valid';
        this.usernameInputErrorMessage = '';
      } else {
        this.usernameInputState = 'invalid';
        this.usernameInputErrorMessage = errors[0].detail;
        this.args.workflowSession.delete('username');
      }
    } catch (e) {
      console.error('Error validating card space username', e);
      Sentry.captureException(e);
      this.args.workflowSession.delete('username');
      this.usernameInputState = 'invalid';
      this.usernameInputErrorMessage =
        'There was an error validating your Card Space username. Please try again or contact support';
    }
  }

  @action async updateUsername(username: string) {
    taskFor(this.updateUsernameTask).perform(username);
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

  @action edit() {
    this.updateUsername(this.username);
    this.args.onIncomplete?.();
  }

  @action save() {
    this.args.onComplete?.();
  }

  @action onImageRemoved() {
    taskFor(this.saveImageEditDataTask).cancelAll();
    this.args.workflowSession.delete('profileImageUrl');
    this.profileImage = '';
    this.imageUploadState = 'valid';
    this.imageUploadErrorMessage = '';
  }

  @task *saveImageEditDataTask(data: {
    preview: string;
    file: Blob;
  }): TaskGenerator<void> {
    try {
      this.profileImage = data.preview;
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
        this.args.workflowSession.setValue('profileImageUrl', url);
        this.profileImage = url;
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
      this.args.workflowSession.delete('profileImageUrl');
      this.profileImage = '';
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
}
