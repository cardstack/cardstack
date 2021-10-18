import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import {
  click,
  find,
  render,
  triggerEvent,
  waitFor,
} from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { ImageUploadSuccessResult } from '@cardstack/web-client/components/image-uploader';

const IMAGE = '[data-test-image-uploader-image]';
const IMAGE_PLACEHOLDER = '[data-test-image-uploader-placeholder]';
const UPLOAD_BUTTON = '[data-test-image-uploader-upload-button]';
const DELETE_BUTTON = '[data-test-image-uploader-delete-button]';
const INPUT = '[data-test-image-uploader-file-input]';
const REQUIREMENTS = '[data-test-image-uploader-requirements]';

let imageDataUri =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

let image: File;

module('Integration | Component | image-uploader', function (hooks) {
  setupRenderingTest(hooks);

  hooks.before(async function () {
    image = await fetch(imageDataUri)
      .then((res) => res.blob())
      .then((blob) => {
        return new File([blob], 'image.png', { type: 'image/png' });
      });
  });

  hooks.beforeEach(async function () {
    this.set('image', '');
    this.set('onUpload', async (file: ImageUploadSuccessResult) => {
      this.set('image', file.preview);
    });
    this.set('onError', (e: Error) => {
      console.error('error uploading image', e);
    });
    this.set('onRemoveImage', () => {
      this.set('image', '');
    });
    this.set('cta', 'Select a Photo');
    this.set('imageDescription', 'Profile image');
    this.set(
      'imageRequirements',
      'Images must be in jpg or png format at least 50x50, min size 35kb, max 200kb'
    );

    await render(hbs`
    <ImageUploader
      @image={{this.image}}
      @rounded={{this.rounded}}
      @placeholderIcon={{this.placeholderIcon}}
      @acceptedFileTypes={{this.acceptedFileTypes}}
      @cta={{this.cta}}
      @imageDescription={{this.imageDescription}}
      @imageRequirements={{this.imageRequirements}}
      @onUpload={{this.onUpload}}
      @onError={{this.onError}}
      @onRemoveImage={{this.onRemoveImage}}
    />
    `);
  });

  test('it can display an image, and a placeholder if there is none', async function (assert) {
    assert.dom(IMAGE).doesNotExist();
    assert.dom(IMAGE_PLACEHOLDER).isVisible();

    this.set('image', imageDataUri);

    assert.dom(IMAGE).hasAttribute('src', imageDataUri);
    assert.dom(DELETE_BUTTON).isVisible();
  });

  test('clicking on the cta triggers a click event on the file input', async function (assert) {
    assert.dom(INPUT).exists();

    let input = find(INPUT);
    let inputTriggered = false;
    input?.addEventListener('click', (e) => {
      e.preventDefault();
      inputTriggered = true;
    });

    await click(UPLOAD_BUTTON);

    assert.ok(inputTriggered);
  });

  test('it can upload an image file', async function (assert) {
    await triggerEvent(find(INPUT)!, 'change', {
      files: [image],
    });

    await waitFor(IMAGE);

    assert.dom(IMAGE).hasAttribute('src', imageDataUri);
    assert.dom(DELETE_BUTTON).isVisible();
  });

  test('it can trigger deletion of an existing image', async function (assert) {
    this.set('image', imageDataUri);

    assert.dom(IMAGE).hasAttribute('src', imageDataUri);
    assert.dom(DELETE_BUTTON).isVisible();

    await click(DELETE_BUTTON);
    assert.dom(IMAGE).doesNotExist();
  });

  test('it allows setting of accepted file types', async function (assert) {
    // assert defaults
    assert.dom(INPUT).hasAttribute('accept', 'image/jpeg, image/png');

    this.set('acceptedFileTypes', 'image/gif');

    assert.dom(INPUT).hasAttribute('accept', 'image/gif');
  });

  test('it displays provided copy', async function (assert) {
    this.set('image', imageDataUri);

    assert.dom(UPLOAD_BUTTON).containsText('Select a Photo');
    assert
      .dom(REQUIREMENTS)
      .containsText(
        'Images must be in jpg or png format at least 50x50, min size 35kb, max 200kb'
      );
    assert.dom(IMAGE).hasAttribute('alt', 'Profile image');

    this.set(
      'imageRequirements',
      'No requirements, feel free to upload anything!'
    );
    this.set('cta', 'Set an image identity');
    this.set('imageDescription', 'You!');

    assert.dom(UPLOAD_BUTTON).containsText('Set an image identity');
    assert
      .dom(REQUIREMENTS)
      .containsText('No requirements, feel free to upload anything!');
    assert.dom(IMAGE).hasAttribute('alt', 'You!');
  });

  test('it allows configuration of image placeholder', async function (assert) {
    assert.dom(IMAGE_PLACEHOLDER).doesNotHaveClass(/--rounded/);

    this.set('rounded', true);

    assert.dom(IMAGE_PLACEHOLDER).hasClass(/--rounded/);

    assert
      .dom(IMAGE_PLACEHOLDER)
      .hasAttribute('data-test-image-uploader-placeholder', 'user');

    this.set('placeholderIcon', 'success');

    assert
      .dom(IMAGE_PLACEHOLDER)
      .hasAttribute('data-test-image-uploader-placeholder', 'success');
  });
});
