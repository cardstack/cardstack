import { ImageUploadSuccessResult } from '@cardstack/web-client/components/image-uploader';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import { ImageValidation } from '@cardstack/web-client/utils/image';
import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import * as Sentry from '@sentry/browser';
export const IMAGE_EDITOR_ELEMENT_ID = 'card-space-image-editor';
import config from '@cardstack/web-client/config/environment';

import { task, TaskGenerator } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import HubAuthentication from '@cardstack/web-client/services/hub-authentication';

export default class CoverPhotoComponent extends Component<WorkflowCardComponentArgs> {
  @service('hub-authentication') declare hubAuthentication: HubAuthentication;

  @tracked coverImage = '';
  @tracked processedImage = {
    type: '',
    filename: '',
    preview: '',
  };
  @tracked showEditor = false;
  @tracked imageUploadErrorMessage = '';
  @tracked imageUploadState = 'valid';
  acceptedFileTypes = ['image/jpeg', 'image/png'];
  desiredWidth = 700;
  desiredHeight = 300;

  imageEditorElement = document.getElementById(IMAGE_EDITOR_ELEMENT_ID);

  constructor(owner: unknown, args: WorkflowCardComponentArgs) {
    super(owner, args);
    this.coverImage =
      this.args.workflowSession.getValue<string>('profileCoverImageUrl') ?? '';
  }

  get profilePhoto() {
    return this.args.workflowSession.getValue('profileImageUrl');
  }

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
    this.args.workflowSession.delete('profileCoverImageUrl');
    this.coverImage = '';
    this.imageUploadState = 'valid';
    this.imageUploadErrorMessage = '';
  }

  @task *saveImageEditDataTask(data: {
    preview: string;
    file: Blob;
  }): TaskGenerator<void> {
    try {
      this.coverImage = data.preview;
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
        this.args.workflowSession.setValue('profileCoverImageUrl', url);
        this.coverImage = url;
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
      this.args.workflowSession.delete('profileCoverImageUrl');
      this.coverImage = '';
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
