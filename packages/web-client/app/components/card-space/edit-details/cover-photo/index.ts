import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import * as Sentry from '@sentry/browser';
export const IMAGE_EDITOR_ELEMENT_ID = 'card-space-image-editor';
import config from '@cardstack/web-client/config/environment';

import { task, TaskGenerator } from 'ember-concurrency';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';
import { IMAGE_UPLOADER_STATES } from '@cardstack/web-client/components/common/image-upload-interface';
import { taskFor } from 'ember-concurrency-ts';

export default class CoverPhotoComponent extends Component<WorkflowCardComponentArgs> {
  @service('hub-authentication') declare hubAuthentication: HubAuthentication;

  // image upload/edit options
  editorOptions = {
    width: 700,
    height: 300,
    rootElement: document.getElementById(IMAGE_EDITOR_ELEMENT_ID),
  };
  validationOptions = {
    fileType: ['image/jpeg', 'image/png'],
    maxFileSize: 1000 * 1000,
  };

  @tracked coverImage = '';
  @tracked
  imageUploadState: typeof IMAGE_UPLOADER_STATES[keyof typeof IMAGE_UPLOADER_STATES] =
    IMAGE_UPLOADER_STATES.default;
  @tracked imageUploadErrorMessage = '';

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    this.coverImage =
      this.args.workflowSession.getValue<string>('profileCoverImageUrl') ?? '';
  }

  get profilePhoto() {
    return this.args.workflowSession.getValue('profileImageUrl');
  }

  @action onError(e: Error, isValidation?: boolean) {
    this.imageUploadState = IMAGE_UPLOADER_STATES.error;
    this.imageUploadErrorMessage = isValidation
      ? e.message
      : 'Failed to upload file';
    if (!isValidation) {
      console.error('Failed to upload file to browser', e);
      Sentry.captureException(e);
    }
  }

  @action onImageRemoved() {
    taskFor(this.saveImageEditDataTask).cancelAll();
    this.args.workflowSession.delete('profileCoverImageUrl');
    this.coverImage = '';
    this.imageUploadState = IMAGE_UPLOADER_STATES.default;
    this.imageUploadErrorMessage = '';
  }

  @task *saveImageEditDataTask(data: {
    preview: string;
    file: Blob;
    filename: string;
  }): TaskGenerator<void> {
    try {
      this.coverImage = data.preview;
      let formdata = new FormData();

      formdata.append(data.filename, data.file, data.filename);

      this.imageUploadState = IMAGE_UPLOADER_STATES.default;
      let response = yield (yield fetch(`${config.hubURL}/upload`, {
        method: 'POST',
        body: formdata,
        headers: {
          Authorization: 'Bearer: ' + this.hubAuthentication.authToken,
        },
      })).json();

      if (response.data?.attributes?.url) {
        let url = response.data.attributes.url;
        this.args.workflowSession.setValue('profileCoverImageUrl', url);
        this.coverImage = url;
        this.imageUploadState = IMAGE_UPLOADER_STATES.default;
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
      this.args.workflowSession.delete('profileCoverImageUrl');
      this.coverImage = '';
      this.imageUploadState = IMAGE_UPLOADER_STATES.error;
      this.imageUploadErrorMessage = 'Failed to upload file';
    }
  }
}
