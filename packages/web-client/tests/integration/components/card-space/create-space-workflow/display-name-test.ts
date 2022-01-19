import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, fillIn, render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { setupHubAuthenticationToken } from '@cardstack/web-client/tests/helpers/setup';

import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import { createDepotSafe } from '@cardstack/web-client/utils/test-factories';
import config from '@cardstack/web-client/config/environment';
import { IMAGE_EDITOR_ELEMENT_ID } from '@cardstack/web-client/components/card-space/create-space-workflow/display-name';
import { mockPngUpload } from '@cardstack/web-client/components/image-uploader';
import { MirageTestContext, setupMirage } from 'ember-cli-mirage/test-support';

const DISPLAY_NAME_FIELD = '[data-test-card-space-display-name-field]';
const DISPLAY_NAME = '[data-test-card-space-display-name]';
const DISPLAY_NAME_INPUT = '[data-test-card-space-display-name-input] input';
const IMAGE_UPLOADER = '[data-test-card-space-image-uploader]';
const IMAGE_UPLOADER_ERROR_MESSAGE = '[data-test-image-uploader-error]';
const IMAGE_UPLOADER_AVATAR =
  '[data-test-card-space-image-uploader-avatar] [data-test-avatar-image]';
const AVATAR = '[data-test-card-space-avatar] [data-test-avatar-image]';
const IMAGE_EDITOR_SAVE_BUTTON = '[data-test-image-editor-save-button]';
const EDIT_BUTTON = '[data-test-card-space-display-name-edit-button]';
const SAVE_BUTTON = '[data-test-card-space-display-name-save-button]';
const PROFILE_CARD_PREVIEW = '[data-test-card-space-profile-card-preview]';

const sampleImage =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==';
const uploadResultImage =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

module(
  'Integration | Component | card-space/create-space-workflow/display-name',
  function (this: MirageTestContext, hooks) {
    setupRenderingTest(hooks);
    setupMirage(hooks);
    setupHubAuthenticationToken(hooks);

    let session: WorkflowSession;

    hooks.beforeEach(async function (this: MirageTestContext) {
      const container = document.querySelector(
        (config as any).APP.rootElement
      )!;
      let fakeImageEditorContainer = document.createElement('div');
      fakeImageEditorContainer.id = IMAGE_EDITOR_ELEMENT_ID;
      container.appendChild(fakeImageEditorContainer);

      session = new WorkflowSession();
      this.set('session', session);
      this.set('onIncomplete', () => {
        this.set('isComplete', false);
      });
      this.set('onComplete', () => {
        this.set('isComplete', true);
      });

      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
      let layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createDepotSafe({}),
      ]);

      // Ensure safes have been loaded, as in a workflow context
      await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

      layer2Service.authenticate();
      layer2Service.test__simulateHubAuthentication('abc123--def456--ghi789');
    });

    test('it renders the card in its default, empty state', async function (assert) {
      await render(hbs`
        <CardSpace::CreateSpaceWorkflow::DisplayName
          @workflowSession={{this.session}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
          @isComplete={{this.isComplete}}
        />
      `);

      assert.dom(DISPLAY_NAME_INPUT).hasNoValue();
      assert.dom(IMAGE_UPLOADER).exists();
      assert.dom(SAVE_BUTTON).containsText('Continue');
      assert.dom(EDIT_BUTTON).doesNotExist();
    });

    test('it renders the card in a filled in, memorialized state', async function (assert) {
      session.setValue({
        displayName: 'monchi',
        profileImageUrl: sampleImage,
      });
      this.set('isComplete', true);
      await render(hbs`
        <CardSpace::CreateSpaceWorkflow::DisplayName
          @workflowSession={{this.session}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
          @isComplete={{this.isComplete}}
        />
      `);

      assert.dom(DISPLAY_NAME).containsText('monchi');
      assert.dom(AVATAR).hasAttribute('src', sampleImage);
      assert.dom(EDIT_BUTTON).containsText('Edit');

      // assert that we can get back to an edit state with the appropriate information still there
      await click(EDIT_BUTTON);
      assert.dom(DISPLAY_NAME_INPUT).hasValue('monchi');
      assert.dom(IMAGE_UPLOADER_AVATAR).hasAttribute('src', sampleImage);
      assert.dom(SAVE_BUTTON).exists();
      assert.dom(EDIT_BUTTON).doesNotExist();
    });

    test('it prevents submission of an invalid display name', async function (this: MirageTestContext, assert) {
      this.server.post(
        '/card-spaces/validate-profile-name',
        function (_schema, request) {
          let profileName = JSON.parse(request.requestBody).data.attributes[
            'profile-name'
          ];
          if (profileName !== 'Errored') {
            return {
              errors: [],
            };
          } else {
            return {
              errors: [
                {
                  status: '422',
                  title: 'Test invalid display name',
                  detail: 'Test invalid display name',
                },
              ],
            };
          }
        }
      );

      await render(hbs`
        <CardSpace::CreateSpaceWorkflow::DisplayName
          @workflowSession={{this.session}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
          @isComplete={{this.isComplete}}
        />
      `);

      assert.dom(SAVE_BUTTON).isDisabled();

      await fillIn(DISPLAY_NAME_INPUT, 'Hello there');
      assert.dom(DISPLAY_NAME_INPUT).hasValue('Hello there');

      await waitFor(
        `${DISPLAY_NAME_INPUT}[data-test-boxel-input-validation-state="valid"]`
      );

      assert.dom(SAVE_BUTTON).isEnabled();

      await fillIn(DISPLAY_NAME_INPUT, 'Errored');
      assert.dom(DISPLAY_NAME_INPUT).hasValue('Errored');

      await waitFor(
        `${DISPLAY_NAME_INPUT}[data-test-boxel-input-validation-state="invalid"]`
      );

      assert.dom(SAVE_BUTTON).isDisabled();
      assert.dom(DISPLAY_NAME_FIELD).containsText('Test invalid display name');
    });

    test('it can upload an image', async function (this: MirageTestContext, assert) {
      this.server.namespace = '';
      this.server.post('/upload', function () {
        return {
          data: {
            type: 'uploaded-asset',
            attributes: {
              url: uploadResultImage,
            },
          },
        };
      });

      await render(hbs`
        <CardSpace::CreateSpaceWorkflow::DisplayName
          @workflowSession={{this.session}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
          @isComplete={{this.isComplete}}
        />
      `);

      // this opens the image editor. users would normally trigger this
      // by clicking the image uploader
      await mockPngUpload(sampleImage, IMAGE_UPLOADER);

      await waitFor(`${IMAGE_EDITOR_SAVE_BUTTON}:not(:disabled)`);

      assert.dom(PROFILE_CARD_PREVIEW).exists();

      await click(IMAGE_EDITOR_SAVE_BUTTON);

      await waitFor(`${IMAGE_UPLOADER_AVATAR}[src="${uploadResultImage}"]`);

      assert.dom(IMAGE_UPLOADER_AVATAR).hasAttribute('src', uploadResultImage);
    });

    test('it can display an error uploading an image', async function (this: MirageTestContext, assert) {
      this.server.namespace = '';
      this.server.post('/upload', function () {
        return {
          errors: [
            {
              status: '-1',
              title: 'Test invalid upload',
              detail: 'Test',
            },
          ],
        };
      });

      await render(hbs`
        <CardSpace::CreateSpaceWorkflow::DisplayName
          @workflowSession={{this.session}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
          @isComplete={{this.isComplete}}
        />
      `);

      // this opens the image editor. users would normally trigger this
      // by clicking the image uploader
      await mockPngUpload(sampleImage, IMAGE_UPLOADER);

      await waitFor(`${IMAGE_EDITOR_SAVE_BUTTON}:not(:disabled)`);

      assert.dom(PROFILE_CARD_PREVIEW).exists();

      await click(IMAGE_EDITOR_SAVE_BUTTON);

      await waitFor(`${IMAGE_UPLOADER} ${IMAGE_UPLOADER_ERROR_MESSAGE}`);

      assert
        .dom(`${IMAGE_UPLOADER} ${IMAGE_UPLOADER_ERROR_MESSAGE}`)
        .containsText('Failed to upload file');
    });
  }
);
