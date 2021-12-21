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

const IMAGE = '[data-test-avatar-image]';
const IMAGE_LOADING = '[data-test-avatar-loading]';
const IMAGE_PLACEHOLDER = '[data-test-avatar-placeholder]';
const UPLOAD_BUTTON = '[data-test-image-uploader-upload-button]';
const DELETE_BUTTON = '[data-test-image-uploader-delete-button]';
const INPUT = '[data-test-image-uploader-file-input]';
const REQUIREMENTS = '[data-test-image-uploader-requirements]';
const ERROR = '[data-test-image-uploader-error]';

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
    this.set(
      'imageRequirements',
      'Images must be in jpg or png format at least 50x50, min size 35kb, max 200kb'
    );

    await render(hbs`
    <ImageUploader
      @image={{this.image}}
      @acceptedFileTypes={{this.acceptedFileTypes}}
      @cta={{this.cta}}
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

    this.set(
      'imageRequirements',
      'No requirements, feel free to upload anything!'
    );
    this.set('cta', 'Set an image identity');

    assert.dom(UPLOAD_BUTTON).containsText('Set an image identity');
    assert
      .dom(REQUIREMENTS)
      .containsText('No requirements, feel free to upload anything!');
  });

  test('it allows modifying of its preview avatar via the default block', async function (assert) {
    this.set('rounded', false);
    this.set('image', imageDataUri);
    this.set('imageDescription', 'Profile');
    this.set('state', 'default');

    await render(hbs`
      <ImageUploader
        @state={{this.state}}
        @image={{this.image}}
        @acceptedFileTypes={{this.acceptedFileTypes}}
        @cta={{this.cta}}
        @imageRequirements={{this.imageRequirements}}
        @onUpload={{this.onUpload}}
        @onError={{this.onError}}
        @onRemoveImage={{this.onRemoveImage}}
      as |ImageUploaderPreview|>
        <ImageUploaderPreview
          @rounded={{this.rounded}}
          @alt={{this.imageDescription}}
          data-test-image-uploader-preview
        />
      </ImageUploader>
    `);

    assert.dom(IMAGE).hasAttribute('src', imageDataUri);
    assert.dom(IMAGE).hasAttribute('alt', 'Profile');
    assert.dom(IMAGE_LOADING).doesNotExist();
    assert
      .dom('[data-test-image-uploader-preview]')
      .doesNotHaveClass(/--rounded/);

    this.set('rounded', true);
    assert.dom('[data-test-image-uploader-preview]').hasClass(/--rounded/);

    this.set('state', 'loading');
    assert.dom(IMAGE_LOADING).isVisible();
  });

  test('it can represent an error state', async function (assert) {
    this.set('state', 'default');
    await render(hbs`
      <ImageUploader
        @state={{this.state}}
        @errorMessage="This is an error"
        @image={{this.image}}
        @acceptedFileTypes={{this.acceptedFileTypes}}
        @cta={{this.cta}}
        @imageRequirements={{this.imageRequirements}}
        @onUpload={{this.onUpload}}
        @onError={{this.onError}}
        @onRemoveImage={{this.onRemoveImage}}
      />
    `);
    assert.dom(ERROR).doesNotExist();
    this.set('state', 'error');
    assert.dom(ERROR).containsText('This is an error');
  });
});
