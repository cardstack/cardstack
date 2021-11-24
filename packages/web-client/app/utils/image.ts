import { tracked } from '@glimmer/tracking';

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
}

const defaultImageRequirements: Required<ImageRequirements> = {
  minWidth: 0,
  maxWidth: Infinity,
  minHeight: 0,
  maxHeight: Infinity,
  minFileSize: 0,
  maxFileSize: 1 * 1000 * 1000, // 1MB
  fileType: ['image/png', 'image/jpeg'],
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

    return {
      valid: fileTypeValid && fileSizeValid && imageSizeValid,
      fileType: fileTypeValid,
      fileSize: fileSizeValid,
      imageSize: imageSizeValid,
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
