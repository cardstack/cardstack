import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import {
  ImageValidation,
  ImageValidationResult,
} from '@cardstack/web-client/utils/image';
import { ImageUploadSuccessResult } from '../components/image-uploader';

class ImageUploaderController extends Controller {
  @tracked editing: string | undefined = undefined;
  @tracked image = '';
  @tracked fileType = 'image/jpeg';
  @tracked showEditor = false;
  @tracked errorMessage = '';

  get imageValidation() {
    return new ImageValidation({
      maxFileSize: Infinity,
    });
  }

  @action async onUpload(image: ImageUploadSuccessResult): Promise<void> {
    let result = await this.imageValidation.validate(image.file);

    if (result.valid) {
      this.editing = image.preview;
      this.fileType = image.file.type;
      this.showEditor = true;
      this.errorMessage = '';
    } else {
      const m: Record<Exclude<keyof ImageValidationResult, 'valid'>, string> = {
        fileSize: 'file size',
        fileType: 'file type',
        imageSize: 'image size',
      };
      const reasons = Object.entries(m)
        .map(
          ([k, v]: [Exclude<keyof ImageValidationResult, 'valid'>, string]) => {
            return !result[k] ? v : '';
          }
        )
        .filter((v) => v)
        .join(' and ');

      this.errorMessage = `Your upload is not valid because of ${reasons}`;
    }
  }

  @action onImageRemoved() {
    this.image = '';
    this.errorMessage = '';
  }

  @action saveImageEditData(data: { preview: string; file: Blob }) {
    this.image = data.preview;
    console.log('got an edited file', data.file);
    this.showEditor = false;
  }
}

export default ImageUploaderController;
