import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { getBase64String } from '@cardstack/web-client/utils/image';
import * as Sentry from '@sentry/browser';
import { find, triggerEvent } from '@ember/test-helpers';

/**
 * Mocks an image upload by triggering a upload event directly on this component's file input
 * Provide a `scopingSelector` to narrow the possible file inputs.
 */
export async function mockPngUpload(
  pngBase64DataUri: string,
  scopingSelector = '*'
) {
  // there is a simpler implementation of using fetch + response.blob
  // however we use mirage, which uses pretender, which uses a fetch polyfill that converts fetch to XHR
  // https://github.com/github/fetch/blob/master/fetch.js
  // and this polyfill does not support data uri: https://github.com/github/fetch/issues/487
  // instead, we do this manually: https://stackoverflow.com/questions/16245767/creating-a-blob-from-a-base64-string-in-javascript
  // so now this mock uploader only supports png base64
  let b64Data = pngBase64DataUri.replace('data:image/png;base64,', '');
  const byteCharacters = atob(b64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/png' });
  let file = new File([blob], 'blob.png', { type: 'image/png' });

  await triggerEvent(
    find(`${scopingSelector} [data-test-image-uploader-file-input]`)!,
    'change',
    {
      files: [file],
    }
  );
}

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
