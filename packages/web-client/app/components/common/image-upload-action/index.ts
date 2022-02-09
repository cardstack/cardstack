import {
  getBase64String,
  ImageRequirements,
  ImageValidation,
} from '@cardstack/web-client/utils/image';
import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import RSVP, { defer } from 'rsvp';
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
    find(`${scopingSelector} [data-test-image-upload-action-file-input]`)!,
    'change',
    {
      files: [file],
    }
  );
}

interface EditorOptions {
  width: number;
  height: number;
  rootElement: HTMLElement;
}

export default class CoverPhotoComponent extends Component<{
  useEditor: boolean;
  editorOptions: EditorOptions;
  validationOptions: Pick<ImageRequirements, 'fileType' | 'maxFileSize'>;
  onUpload:
    | ((result: { preview: string; file: Blob; filename: string }) => void)
    | ((result: {
        preview: string;
        file: Blob;
        filename: string;
      }) => Promise<void>);
  onError: ((error: Error) => void) | ((error: Error) => Promise<void>);
}> {
  uploader!: HTMLInputElement;
  @tracked processedImage: {
    type: string;
    filename: string;
    preview: string;
    deferred: RSVP.Deferred<
      | {
          file: Blob;
          preview: string;
          filename: string;
        }
      | undefined
    > | null;
  } = {
    type: '',
    filename: '',
    preview: '',
    deferred: null,
  };
  @tracked showEditor = false;

  @action setUploader(element: HTMLInputElement) {
    this.uploader = element;
  }

  @action async onFileChanged(e: InputEvent) {
    let files = (e.target as HTMLInputElement).files;
    if (!files) return;

    this.handleUploadedFile(files[0]);

    // this is a change event, so we need to clear the files each time
    // to handle uploading a file, deleting it, then uploading the same file
    this.uploader.value = '';
  }

  @action startUpload() {
    this.uploader.click();
  }

  get imageValidation() {
    return new ImageValidation(this.args.validationOptions);
  }

  @action async handleUploadedFile(file: File): Promise<void> {
    try {
      let preview = await getBase64String(file);
      let validationResult = await this.imageValidation.validate(file);

      if (!validationResult.valid) {
        this.args.onError(new Error(validationResult.message));
        return;
      }

      if (this.args.useEditor === false) {
        this.args.onUpload({
          file: file,
          filename: file.name,
          preview,
        });
        return;
      }

      this.processedImage = {
        type: file.type,
        filename: file.name,
        preview,
        deferred: defer(),
      };
      this.showEditor = true;

      // onImageEditComplete resolves this with a preview and file
      // closeEditor resolves this with undefined
      let result = await this.processedImage.deferred!.promise;

      if (result) this.args.onUpload(result);
    } catch (e) {
      this.args.onError(e);
    }
  }

  // saving or closing the editor will automatically resolve the deferred
  @action closeEditor() {
    if (this.processedImage.deferred !== null) {
      this.processedImage.deferred.resolve();
    }

    this.showEditor = false;
    this.processedImage = {
      type: '',
      filename: '',
      preview: '',
      deferred: null,
    };
  }

  @action onImageEditComplete(data: { preview: string; file: Blob }) {
    this.processedImage.deferred?.resolve({
      ...data,
      filename: this.processedImage.filename,
    });
  }
}
