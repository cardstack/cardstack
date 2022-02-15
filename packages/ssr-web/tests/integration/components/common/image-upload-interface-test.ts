import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { IMAGE_UPLOADER_STATES } from '@cardstack/ssr-web/components/common/image-upload-interface';
import sinon from 'sinon';

const IMAGE = '[data-test-avatar-image]';
const IMAGE_LOADING = '[data-test-avatar-loading]';
const IMAGE_PLACEHOLDER = '[data-test-avatar-placeholder]';
const UPLOAD_BUTTON = '[data-test-image-upload-interface-upload-button]';
const DELETE_BUTTON = '[data-test-image-upload-interface-delete-button]';
const REQUIREMENTS = '[data-test-image-upload-interface-requirements]';
const ERROR = '[data-test-image-upload-interface-error]';

let imageDataUri =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

module(
  'Integration | Component | common/image-upload-interface',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(async function () {
      this.set('state', IMAGE_UPLOADER_STATES.default);
      this.set('image', '');
      this.set('onRemoveImage', () => {
        this.set('image', '');
      });
      this.set('cta', 'Select a Photo');
      this.set(
        'imageRequirements',
        'Images must be in jpg or png format at least 50x50, min size 35kb, max 200kb'
      );
      this.set('startUpload', () => {});

      await render(hbs`
    <Common::ImageUploadInterface
      @state={{this.state}}
      @image={{this.image}}
      @cta={{this.cta}}
      @imageRequirements={{this.imageRequirements}}
      @onRemoveImage={{this.onRemoveImage}}
      @startUpload={{this.startUpload}}
    />
    `);
    });

    test('it can display an image placeholder', async function (assert) {
      this.set('image', '');

      assert.dom(IMAGE).doesNotExist();
      assert.dom(IMAGE_PLACEHOLDER).isVisible();
    });

    test('it can display an image', async function (assert) {
      this.set('image', imageDataUri);

      assert.dom(IMAGE).hasAttribute('src', imageDataUri);
      assert.dom(DELETE_BUTTON).isVisible();
    });

    test('it can display an image with a loading state', async function (assert) {
      this.set('image', imageDataUri);
      this.set('state', IMAGE_UPLOADER_STATES.loading);

      assert.dom(IMAGE).hasAttribute('src', imageDataUri);
      assert.dom(IMAGE_LOADING).isVisible();
    });

    test('clicking on the cta triggers the startUpload callback', async function (assert) {
      let startUploadSpy = sinon.spy();
      this.set('startUpload', startUploadSpy);

      assert.ok(startUploadSpy.notCalled);

      await click(UPLOAD_BUTTON);

      assert.ok(startUploadSpy.calledOnce);
    });

    test('clicking on the delete button triggers the onRemoveImage callback', async function (assert) {
      let onRemoveImageSpy = sinon.spy();
      this.set('image', imageDataUri);
      this.set('onRemoveImage', onRemoveImageSpy);

      assert.ok(onRemoveImageSpy.notCalled);

      await click(DELETE_BUTTON);

      assert.ok(onRemoveImageSpy.calledOnce);
    });

    test('it displays the cta text', async function (assert) {
      this.set('cta', 'Select a Photo');
      assert.dom(UPLOAD_BUTTON).containsText('Select a Photo');
    });

    test('it displays the image requirement text in the default state', async function (assert) {
      assert
        .dom(REQUIREMENTS)
        .containsText(
          'Images must be in jpg or png format at least 50x50, min size 35kb, max 200kb'
        );
    });

    test('it allows modifying of its preview avatar via the default block', async function (assert) {
      this.set('rounded', false);
      this.set('image', imageDataUri);
      this.set('imageDescription', 'Profile');
      this.set('state', IMAGE_UPLOADER_STATES.default);

      await render(hbs`
       <Common::ImageUploadInterface
        @state={{this.state}}
        @image={{this.image}}
        @cta={{this.cta}}
        @imageRequirements={{this.imageRequirements}}
        @onRemoveImage={{this.onRemoveImage}}
        @startUpload={{this.startUpload}}
        as |ImageUploaderPreview|
      >
        <ImageUploaderPreview
          @rounded={{this.rounded}}
          @alt={{this.imageDescription}}
          data-test-image-upload-interface-preview
        />
      </Common::ImageUploadInterface>
    `);

      assert.dom(IMAGE).hasAttribute('src', imageDataUri);
      assert.dom(IMAGE).hasAttribute('alt', 'Profile');
      assert.dom(IMAGE_LOADING).doesNotExist();
      assert
        .dom('[data-test-image-upload-interface-preview]')
        .doesNotHaveClass(/--rounded/);

      this.set('rounded', true);
      assert
        .dom('[data-test-image-upload-interface-preview]')
        .hasClass(/--rounded/);
    });

    test('it can represent an error state', async function (assert) {
      this.set('state', IMAGE_UPLOADER_STATES.default);

      await render(hbs`
       <Common::ImageUploadInterface
         @state={{this.state}}
         @image={{this.image}}
         @cta={{this.cta}}
         @imageRequirements={{this.imageRequirements}}
         @onRemoveImage={{this.onRemoveImage}}
         @startUpload={{this.startUpload}}
         @errorMessage={{this.errorMessage}}
       />
    `);

      assert.dom(ERROR).doesNotExist();

      this.set('state', IMAGE_UPLOADER_STATES.error);
      this.set('errorMessage', 'This is an error');

      assert.dom(ERROR).containsText('This is an error');
    });
  }
);
