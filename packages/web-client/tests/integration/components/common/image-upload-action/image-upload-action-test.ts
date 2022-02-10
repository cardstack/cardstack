import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, find, render, waitFor, waitUntil } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { mockPngUpload } from '@cardstack/web-client/components/common/image-upload-action';
import config from '@cardstack/web-client/config/environment';
import sinon from 'sinon';

const INPUT = '[data-test-image-upload-action-file-input]';
const IMAGE_EDITOR = '[data-test-image-editor]';
const IMAGE_EDITOR_CANCEL_BUTTON = '[data-test-image-editor-cancel-button]';
const IMAGE_EDITOR_SAVE_BUTTON = '[data-test-image-editor-save-button]';
const IMAGE_EDITOR_ROTATE_BUTTON = '[data-test-image-editor-rotate-ccw-button]';
const IMAGE_EDITOR_PREVIEW = '[data-test-image-editor-preview-section]';

module(
  'Integration | Component | common/image-upload-action',
  function (hooks) {
    setupRenderingTest(hooks);

    let imageDataUri =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    module('with editor', function (hooks) {
      hooks.beforeEach(function () {
        const container = document.querySelector(
          (config as any).APP.rootElement
        )!;
        const editorContainer = document.createElement('div');
        container.appendChild(editorContainer);

        this.set('validationOptions', {
          fileType: ['image/png'],
          maxFileSize: 10000000,
        });
        this.set('useEditor', true);
        this.set('editorOptions', {
          width: 430,
          height: 230,
          rootElement: editorContainer,
        });
      });

      test('it opens an editor upon successful file upload', async function (assert) {
        let onUploadSpy = sinon.spy();
        this.set('onUpload', onUploadSpy);

        await render(hbs`
          <Common::ImageUploadAction
            @useEditor={{this.useEditor}}
            @editorOptions={{this.editorOptions}}
            @validationOptions={{this.validationOptions}}
            @onUpload={{this.onUpload}}
          />
        `);

        await mockPngUpload(imageDataUri);

        await waitFor(IMAGE_EDITOR);

        let imageEditorElement = find(IMAGE_EDITOR) as HTMLElement;

        assert.equal(imageEditorElement.dataset.testImageEditorWidth, '430');
        assert.equal(imageEditorElement.dataset.testImageEditorHeight, '230');
        assert.equal(
          imageEditorElement.dataset.testImageEditorValue,
          imageDataUri
        );
        assert.ok(onUploadSpy.notCalled);
      });

      test('it calls onUpload callback for editor save', async function (assert) {
        let onUploadSpy = sinon.spy();
        this.set('onUpload', onUploadSpy);

        await render(hbs`
          <Common::ImageUploadAction
            @useEditor={{this.useEditor}}
            @editorOptions={{this.editorOptions}}
            @validationOptions={{this.validationOptions}}
            @onUpload={{this.onUpload}}
          />
        `);

        await mockPngUpload(imageDataUri);

        await waitFor(IMAGE_EDITOR);

        await click(IMAGE_EDITOR_ROTATE_BUTTON);

        await click(IMAGE_EDITOR_SAVE_BUTTON);

        assert.equal(onUploadSpy.lastCall.args[0].filename, 'blob.png');
        assert.ok(onUploadSpy.lastCall.args[0].file);
        assert.ok(onUploadSpy.lastCall.args[0].preview);
      });

      test('it does not call the onUpload callback if the editor is closed without saving', async function (assert) {
        let onUploadSpy = sinon.spy();
        this.set('onUpload', onUploadSpy);

        await render(hbs`
          <Common::ImageUploadAction
            @useEditor={{this.useEditor}}
            @editorOptions={{this.editorOptions}}
            @validationOptions={{this.validationOptions}}
            @onUpload={{this.onUpload}}
          />
        `);

        await mockPngUpload(imageDataUri);

        await waitFor(IMAGE_EDITOR);

        await click(IMAGE_EDITOR_CANCEL_BUTTON);

        assert.ok(onUploadSpy.notCalled);
      });

      test('it yields a preview for the image editor', async function (assert) {
        await render(hbs`
          <Common::ImageUploadAction
            @useEditor={{this.useEditor}}
            @editorOptions={{this.editorOptions}}
            @validationOptions={{this.validationOptions}}
          >
            <:editor-preview as |preview|>
              <div data-test-editor-preview-string>
                {{preview}}
              </div>
            </:editor-preview>
          </Common::ImageUploadAction>
        `);

        await mockPngUpload(imageDataUri);

        await waitFor(IMAGE_EDITOR);

        // there's a transform that happens between the upload and the displaying in the editor, so not asserting on a precise string
        assert
          .dom(`${IMAGE_EDITOR_PREVIEW} [data-test-editor-preview-string]`)
          .hasAnyText();
      });
    });

    module('without editor', function (hooks) {
      hooks.beforeEach(async function () {
        this.set('validationOptions', {
          fileType: ['image/png'],
          maxFileSize: 10000000,
        });
        this.set('useEditor', false);
        this.set('editorOptions', null);
      });

      test('it has an input which accepts the file type specified in validationOptions', async function (assert) {
        await render(hbs`
          <Common::ImageUploadAction
            @useEditor={{this.useEditor}}
            @editorOptions={{this.editorOptions}}
            @validationOptions={{this.validationOptions}}
          />
        `);

        assert.dom(INPUT).hasAttribute('accept', 'image/png');

        this.set('validationOptions', {
          fileType: ['image/gif'],
          maxFileSize: 10000000,
        });

        assert.dom(INPUT).hasAttribute('accept', 'image/gif');
      });

      test('it yields a startUpload callback that triggers a click event on the hidden input if useEditor is false', async function (assert) {
        await render(hbs`
          <Common::ImageUploadAction
            @useEditor={{this.useEditor}}
            @editorOptions={{this.editorOptions}}
            @validationOptions={{this.validationOptions}}
            as |startUpload|
          >
            <button data-test-start-upload-button type="button" {{on "click" startUpload}}>Start Upload</button>
          </Common::ImageUploadAction>
        `);

        let inputElement = find(INPUT);
        let inputClicked = false;
        inputElement?.addEventListener('click', function (event) {
          inputClicked = true;
          event.preventDefault();
        });

        await click('[data-test-start-upload-button]');

        assert.ok(inputClicked);
      });

      test('it calls the onUpload callback upon successful file upload', async function (assert) {
        let onUploadSpy = sinon.spy();
        this.set('onUpload', onUploadSpy);

        await render(hbs`
          <Common::ImageUploadAction
            @useEditor={{this.useEditor}}
            @editorOptions={{this.editorOptions}}
            @validationOptions={{this.validationOptions}}
            @onUpload={{this.onUpload}}
            as |startUpload|
          >
            <button data-test-start-upload-button type="button" {{on "click" startUpload}}>Start Upload</button>
          </Common::ImageUploadAction>
        `);

        assert.ok(onUploadSpy.notCalled);

        await mockPngUpload(imageDataUri);
        await waitUntil(() => onUploadSpy.calledOnce);

        assert.equal(onUploadSpy.lastCall.args[0].filename, 'blob.png');
        assert.ok(onUploadSpy.lastCall.args[0].file);
        assert.ok(onUploadSpy.lastCall.args[0].preview);
      });

      test('it calls the onError callback for validation errors', async function (assert) {
        let onUploadSpy = sinon.spy();
        let onErrorSpy = sinon.spy();
        this.set('onUpload', onUploadSpy);
        this.set('onError', onErrorSpy);
        this.set('validationOptions', {
          fileType: ['image/gif'],
          maxFileSize: 10000000,
        });

        await render(hbs`
          <Common::ImageUploadAction
            @useEditor={{this.useEditor}}
            @editorOptions={{this.editorOptions}}
            @validationOptions={{this.validationOptions}}
            @onUpload={{this.onUpload}}
            @onError={{this.onError}}
          />
        `);

        // this will error because the accepted image type is gif
        await mockPngUpload(imageDataUri);
        await waitUntil(() => onErrorSpy.calledOnce);

        // check that we have the right validation message,
        // and a boolean to indicate that it's a validation message
        // this is so we can use the validation message in the UI
        // and skip sending to sentry
        assert.equal(
          onErrorSpy.lastCall.args[0].message,
          'Please upload an image with a file type of gif'
        );
        assert.equal(onErrorSpy.lastCall.args[1], true);
        assert.ok(onUploadSpy.notCalled);
      });
    });
  }
);
