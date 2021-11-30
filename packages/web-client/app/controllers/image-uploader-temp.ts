import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import { ImageValidation } from '@cardstack/web-client/utils/image';
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
      this.errorMessage = result.message;
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
