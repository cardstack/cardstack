import { tracked } from '@glimmer/tracking';
import fileSize from 'filesize';

export interface ImageRequirements {
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  minFileSize: number;
  maxFileSize: number;
  fileType: string[];
}

export interface ImageValidationResult {
  valid: boolean;
  fileSize: boolean;
  fileType: boolean;
  imageSize: boolean;
  message: string;
}

const defaultImageRequirements: Required<ImageRequirements> = {
  minWidth: 0,
  maxWidth: Infinity,
  minHeight: 0,
  maxHeight: Infinity,
  minFileSize: 0,
  maxFileSize: 2 * 1024 * 1024, // 2MB
  fileType: ['image/png', 'image/jpeg', 'image/svg+xml'],
};

export class ImageValidation {
  @tracked minHeight = defaultImageRequirements.minHeight;
  @tracked maxHeight = defaultImageRequirements.maxHeight;
  @tracked minWidth = defaultImageRequirements.minWidth;
  @tracked maxWidth = defaultImageRequirements.maxWidth;
  @tracked minFileSize = defaultImageRequirements.minFileSize;
  @tracked maxFileSize = defaultImageRequirements.maxFileSize;
  @tracked fileType = defaultImageRequirements.fileType;

  constructor(options?: Partial<ImageRequirements>) {
    this.minHeight = options?.minHeight ?? defaultImageRequirements.minHeight;
    this.maxHeight = options?.maxHeight ?? defaultImageRequirements.maxHeight;

    if (
      isNaN(this.minHeight) ||
      isNaN(this.maxHeight) ||
      this.minHeight > this.maxHeight
    ) {
      throw new Error('Invalid height limit config for image validation');
    }

    this.minWidth = options?.minWidth ?? defaultImageRequirements.minWidth;
    this.maxWidth = options?.maxWidth ?? defaultImageRequirements.maxWidth;

    if (
      isNaN(this.minWidth) ||
      isNaN(this.maxWidth) ||
      this.minWidth > this.maxWidth
    ) {
      throw new Error('Invalid width limit config for image validation');
    }

    this.minFileSize =
      options?.minFileSize ?? defaultImageRequirements.minFileSize;
    this.maxFileSize =
      options?.maxFileSize ?? defaultImageRequirements.maxFileSize;
    if (
      isNaN(this.minFileSize) ||
      isNaN(this.maxFileSize) ||
      this.minFileSize > this.maxFileSize
    ) {
      throw new Error('Invalid file size limit config for image validation');
    }
    this.fileType = options?.fileType ?? defaultImageRequirements.fileType;
    if (
      !Array.isArray(this.fileType) ||
      this.fileType.some((v) => !v.startsWith('image/'))
    ) {
      throw new Error('Invalid file type config for image validation');
    }
  }

  async validate(file: File): Promise<ImageValidationResult> {
    let fileTypeValid = this.fileType.includes(file.type);
    let fileSizeValid = false;
    let imageSizeValid = false;
    if (fileTypeValid) {
      fileSizeValid =
        file.size >= this.minFileSize && file.size <= this.maxFileSize;
      imageSizeValid = await this.imageSizeWithinBounds(file);
    }

    let message = '';

    if (!fileTypeValid) {
      const { fileType } = this;
      const subtypeOnly = fileType.map((v) => v.replace(/^image\//, ''));
      if (subtypeOnly.length === 1) {
        message = `Please upload an image with a file type of ${subtypeOnly[0]}`;
      } else {
        const lastItem = subtypeOnly.pop();
        message = `Please upload an image with a file type of ${subtypeOnly.join(
          ', '
        )} or ${lastItem}`;
      }
    } else if (!fileSizeValid) {
      const { minFileSize, maxFileSize } = this;
      if (maxFileSize === Infinity) {
        message = `Please upload a file with size greater than ${fileSize(
          minFileSize
        )}`;
      } else if (minFileSize <= 0) {
        message = `Please upload a file with size less than ${fileSize(
          maxFileSize
        )}`;
      } else {
        message = `Please upload a file between ${fileSize(
          minFileSize
        )} and ${fileSize(maxFileSize)}.`;
      }
    } else if (!imageSizeValid) {
      const { minWidth, maxWidth, minHeight, maxHeight } = this;
      // ignoring the case where we want to restrict width but not height
      if (
        maxWidth !== Infinity &&
        maxHeight !== Infinity &&
        minWidth > 0 &&
        minHeight > 0
      ) {
        message = `Please upload an image larger than ${minWidth}x${minHeight}, and smaller than ${maxWidth}x${maxHeight}`;
      } else if (minWidth > 0 && minHeight > 0) {
        message = `Please upload an image larger than ${minWidth}x${minHeight}`;
      } else if (maxWidth !== Infinity && maxHeight !== Infinity) {
        message = `Please upload an image smaller than ${maxWidth}x${maxHeight}`;
      } else {
        message = `Please upload an image larger than ${minWidth}x${minHeight}`;
      }
    }

    return {
      valid: fileTypeValid && fileSizeValid && imageSizeValid,
      fileType: fileTypeValid,
      fileSize: fileSizeValid,
      imageSize: imageSizeValid,
      message,
    };
  }

  async imageSizeWithinBounds(file: File): Promise<boolean> {
    let { minWidth, maxWidth, minHeight, maxHeight } = this;
    let base64Image: string = await getBase64String(file);
    return new Promise((resolve, reject) => {
      try {
        let img = new Image();
        let imageWidth = 0;
        let imageHeight = 0;
        img.onload = function () {
          imageWidth = (this as HTMLImageElement).width;
          imageHeight = (this as HTMLImageElement).height;
          resolve(
            imageWidth >= minWidth &&
              imageWidth <= maxWidth &&
              imageHeight >= minHeight &&
              imageHeight <= maxHeight
          );
        };
        img.onerror = function (e) {
          console.error('Failed to get image height and width');
          console.error(e);
          reject(e);
        };
        img.src = base64Image;
      } catch (e) {
        console.error(e);
        reject(e);
      }
    });
  }
}

export async function getBase64String(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = function (error) {
      reject(error);
    };
    reader.readAsDataURL(file);
  });
}
