import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

interface ImageEditorComponentArguments {
  aspectRatio: number; // width in px
  image: string;
  rounded: false;
  saveImageEditData(data: { image: string }): void;
  onClose(): void;
}

export default class ImageEditorComponent extends Component<ImageEditorComponentArguments> {
  cropper: Cropper | undefined;
  @tracked loading = true;
  @tracked output: string | undefined;

  @action initializeCropper(image: HTMLImageElement) {
    let component = this;
    this.cropper = new Cropper(image, {
      autoCrop: true,
      aspectRatio: this.args.aspectRatio,
      autoCropArea: 0.9,
      viewMode: 1,
      cropBoxMovable: false,
      cropBoxResizable: false,
      dragMode: 'move',
      toggleDragModeOnDblclick: false,
      ready: function (this: HTMLImageElement & { cropper: Cropper }) {
        const dataURL = this.cropper.getCroppedCanvas().toDataURL();
        component.output = dataURL;
        component.loading = false;
      },
      cropend(this: HTMLImageElement & { cropper: Cropper }) {
        const dataURL = this.cropper.getCroppedCanvas().toDataURL();
        component.output = dataURL;
      },
      zoom(this: HTMLImageElement & { cropper: Cropper }) {
        const dataURL = this.cropper.getCroppedCanvas().toDataURL();
        component.output = dataURL;
      },
    });
  }

  @action rotate(amountInDegrees: number) {
    if (this.loading) return;
    this.cropper?.rotate(amountInDegrees);
    const dataURL = this.cropper?.getCroppedCanvas().toDataURL();
    this.output = dataURL;
  }

  @action close() {
    this.args.onClose();
    this.loading = true;
  }

  @action save() {
    if (this.loading || !this.output) return;

    this.args.saveImageEditData({
      image: this.output!,
    });

    this.args.onClose();
    this.loading = true;
  }
}
