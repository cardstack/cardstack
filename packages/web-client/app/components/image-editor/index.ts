import { action } from '@ember/object';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

interface ImageEditorComponentArguments {
  width: number;
  height: number;
  image: string; // data url or url
  fileType: string;
  rounded: false;
  saveImageEditData(data: { preview: string; file: Blob }): void;
  onClose(): void;
}

export default class ImageEditorComponent extends Component<ImageEditorComponentArguments> {
  cropper: Cropper | undefined;
  canvas: HTMLCanvasElement | undefined;
  @tracked loading = true;
  @tracked preview: string | undefined;

  @action initializeCropper(image: HTMLImageElement) {
    let component = this;
    this.cropper = new Cropper(image, {
      autoCrop: true,
      aspectRatio: this.args.width / this.args.height,
      autoCropArea: 0.9,
      viewMode: 1,
      cropBoxMovable: false,
      cropBoxResizable: false,
      dragMode: 'move',
      toggleDragModeOnDblclick: false,
      ready: async function (this: HTMLImageElement & { cropper: Cropper }) {
        component.updatePreview();
        component.loading = false;
      },
      cropend: async function (this: HTMLImageElement & { cropper: Cropper }) {
        component.updatePreview();
      },
      zoom: async function (this: HTMLImageElement & { cropper: Cropper }) {
        component.updatePreview();
      },
    });
  }

  @action async rotate(amountInDegrees: number) {
    if (this.loading) return;
    this.cropper!.rotate(amountInDegrees);
    this.updatePreview();
  }

  updatePreview() {
    this.canvas = this.getCroppedCanvas();
    this.preview = this.getCroppedPreviewImage();
  }

  @action close() {
    this.args.onClose();
    this.loading = true;
  }

  @action async save() {
    if (this.loading || !this.preview || !this.canvas) return;

    this.args.saveImageEditData({
      file: await this.getCroppedImageFile(),
      preview: this.preview,
    });

    this.args.onClose();
    this.loading = true;
  }

  async getCroppedImageFile(): Promise<Blob> {
    return await new Promise((resolve, reject) => {
      try {
        this.canvas?.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(
                  new Error('Failed to construct blob from cropped image')
                ),
          this.args.fileType ?? 'png',
          1
        );
      } catch (e) {
        reject(e);
      }
    });
  }

  getCroppedPreviewImage() {
    return this.canvas!.toDataURL();
  }

  getCroppedCanvas() {
    const canvas = this.cropper!.getCroppedCanvas({
      width: this.args.width,
      height: this.args.height,
      minWidth: this.args.width,
      minHeight: this.args.height,
      // be forgiving with this so we can still get high res images
      // but cap it because there are limits to canvas size
      // this is used to render the image onto a canvas (before we get the cropped version)
      maxWidth: Math.min(this.args.width * 5, 20000),
      maxHeight: Math.min(this.args.height * 5, 20000),
      fillColor: this.args.fileType === 'image/png' ? undefined : '#fff',
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'high',
    });

    return canvas;
  }
}
