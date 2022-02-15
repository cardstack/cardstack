import {
  ImageRequirements,
  ImageValidation,
} from '@cardstack/ssr-web/utils/image';
import fileSize from 'filesize';
import { module, test } from 'qunit';

const minFileSizeInKb = 4;
const maxFileSizeInKb = 9;

// this config should pass with the provided file by default
// the file is 24 * 36, ~5KB, png
const config: ImageRequirements = {
  minFileSize: minFileSizeInKb * 1024,
  maxFileSize: maxFileSizeInKb * 1024,
  minWidth: 20,
  maxWidth: 40,
  minHeight: 20,
  maxHeight: 40,
  fileType: ['image/jpeg', 'image/png'],
};

let image: File;

module('Unit | image-validation', function (hooks) {
  hooks.before(async function () {
    image = await createImage();
  });

  test('It has default validation', async function (assert) {
    let validator = new ImageValidation();
    assert.equal(typeof validator.minFileSize, 'number');
    assert.equal(typeof validator.maxFileSize, 'number');
    assert.equal(typeof validator.minHeight, 'number');
    assert.equal(typeof validator.maxHeight, 'number');
    assert.equal(typeof validator.minWidth, 'number');
    assert.equal(typeof validator.maxWidth, 'number');
    assert.deepEqual(validator.fileType, ['image/png', 'image/jpeg']);
  });

  test('Its default validation can be overwritten', async function (assert) {
    let validator = new ImageValidation(config);
    assert.equal(validator.minFileSize, config.minFileSize);
    assert.equal(validator.maxFileSize, config.maxFileSize);
    assert.equal(validator.minHeight, config.minHeight);
    assert.equal(validator.maxHeight, config.maxHeight);
    assert.equal(validator.minWidth, config.minWidth);
    assert.equal(validator.maxWidth, config.maxWidth);
    assert.deepEqual(validator.fileType, config.fileType);
  });

  test('It throws when set up with invalid config', async function (assert) {
    let invalidConfigs: Record<string, Partial<ImageRequirements>> = {
      width: {
        minWidth: 30,
        maxWidth: 29,
      },
      height: {
        minHeight: 70,
        maxHeight: 69,
      },
      fileSize: {
        minFileSize: 2,
        maxFileSize: 0,
      },
      fileType: {
        fileType: ['boop'],
      },
    };

    let invalidConfigErrorMessages: Record<
      keyof typeof invalidConfigs,
      string
    > = {
      width: 'Invalid width limit config for image validation',
      height: 'Invalid height limit config for image validation',
      fileSize: 'Invalid file size limit config for image validation',
      fileType: 'Invalid file type config for image validation',
    };

    for (let invalidConfigType in invalidConfigs) {
      assert.throws(
        () => {
          new ImageValidation({
            ...config,
            ...invalidConfigs[invalidConfigType],
          });
        },
        (e: Error) =>
          e.message.includes(invalidConfigErrorMessages[invalidConfigType]),
        `Throws the appropriate error for invalid ${invalidConfigType} configuration`
      );
    }
  });

  test('It can detect a valid image', async function (assert) {
    let validator = new ImageValidation(config);
    let result = await validator.validate(image);
    assert.ok(
      result.valid && result.fileType && result.fileSize && result.imageSize,
      'Validation succeeds'
    );
  });

  test('It can detect invalid image file type', async function (assert) {
    let validator = new ImageValidation({ ...config, fileType: ['image/gif'] });
    let result = await validator.validate(image);
    assert.notOk(
      result.valid,
      'Validation should not succeed for invalid file type'
    );
    assert.notOk(result.fileType, 'Invalid file type is detected');
    assert.equal(
      result.message,
      'Please upload an image with a file type of gif'
    );
    assert.notOk(
      result.fileSize,
      'File size is not validated if file type is not valid'
    );
    assert.notOk(
      result.imageSize,
      'Image size is not validated if file type is not valid'
    );
  });

  test('It can detect invalid image size', async function (assert) {
    let failingConfigs: Record<string, Partial<ImageRequirements>> = {
      minWidthFails: {
        minWidth: 30,
        maxWidth: 40,
      },
      maxWidthFails: {
        minWidth: 18,
        maxWidth: 20,
      },
      minHeightFails: {
        minHeight: 70,
        maxHeight: 100,
      },
      maxHeightFails: {
        minHeight: 20,
        maxHeight: 30,
      },
    };

    for (let condition in failingConfigs) {
      let validator = new ImageValidation({
        ...config,
        ...failingConfigs[condition],
      });
      let validationResult = await validator.validate(image);
      assert.notOk(
        validationResult.valid,
        `Validation should not succeed, tested condition: ${condition}`
      );
      assert.notOk(
        validationResult.imageSize,
        `Image size should not be valid, tested condition: ${condition}`
      );
      assert.equal(
        validationResult.message,
        `Please upload an image larger than ${validator.minWidth}x${validator.minHeight}, and smaller than ${validator.maxWidth}x${validator.maxHeight}`
      );
      assert.ok(validationResult.fileSize, 'File size should be valid');
      assert.ok(validationResult.fileType, 'File type should be valid');
    }
  });

  test('It can detect invalid file size', async function (assert) {
    let failingConfigs: Record<string, Partial<ImageRequirements>> = {
      minFileSizeFails: {
        minFileSize: 30 * 1024,
        maxFileSize: 35 * 1024,
      },
      maxFileSizeFails: {
        minFileSize: 0,
        maxFileSize: 1,
      },
    };

    let failingMessages: Record<
      keyof typeof failingConfigs,
      (validator: ImageValidation) => string
    > = {
      minFileSizeFails: (validator: ImageValidation) =>
        `Please upload a file between ${fileSize(
          validator.minFileSize
        )} and ${fileSize(validator.maxFileSize)}`,
      maxFileSizeFails: (validator: ImageValidation) =>
        `Please upload a file with size less than ${fileSize(
          validator.maxFileSize
        )}`,
    };

    for (let condition in failingConfigs) {
      let validator = new ImageValidation({
        ...config,
        ...failingConfigs[condition],
      });
      let validationResult = await validator.validate(image);
      assert.notOk(
        validationResult.valid,
        `Validation should not succeed, tested condition: ${condition}`
      );
      assert.notOk(
        validationResult.fileSize,
        `File size should not be valid, tested condition: ${condition}`
      );
      assert.equal(
        validationResult.message,
        failingMessages[condition](validator)
      );
      assert.ok(validationResult.imageSize, 'Image size should be valid');
      assert.ok(validationResult.fileType, 'File type should be valid');
    }
  });
});

async function createImage() {
  return await fetch(
    `data:image/png;base64,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`
  )
    .then((res) => res.blob())
    .then((blob) => {
      return new File([blob], 'small-image.png', { type: 'image/png' });
    });
}
