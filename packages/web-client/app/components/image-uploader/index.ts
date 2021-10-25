import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { getBase64String } from '@cardstack/web-client/utils/image';
import * as Sentry from '@sentry/browser';

export interface ImageUploadSuccessResult {
  file: File;
  preview: string;
}

interface ImageUploaderArguments {
  onUpload(image: ImageUploadSuccessResult): unknown;
  onError?(e: Error): unknown;
  onRemoveImage(): unknown;
}

export default class ImageUploaderComponent extends Component<ImageUploaderArguments> {
  @tracked image: string | undefined;
  uploader!: HTMLInputElement;

  @action setUploader(element: HTMLInputElement) {
    this.uploader = element;
  }

  @action async onFileChanged(e: InputEvent) {
    try {
      let files = (e.target as HTMLInputElement).files;
      if (!files) return;
      this.args.onUpload({
        file: files[0],
        preview: await getBase64String(files[0]),
      });
    } catch (e) {
      console.error('Failed to upload image');
      console.error(e);
      this.args.onError?.(e);
      Sentry.captureException(e);
    } finally {
      // this is a change event, so we need to clear the files each time
      // to handle uploading a file, deleting it, then uploading the same file
      this.uploader.value = '';
    }
  }

  @action upload() {
    this.uploader.click();
  }
}
