import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, fillIn, blur, render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';

import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import { Response as MirageResponse } from 'ember-cli-mirage';
import { createPrepaidCardSafe } from '@cardstack/web-client/utils/test-factories';
import Layer2Network from '@cardstack/web-client/services/layer2-network';

interface Context extends MirageTestContext {}

// selectors
let PREVIEW = '[data-test-profile-customization-profile-preview]';
let PROFILE = '[data-test-profile]';
let PROFILE_LOGO = '[data-test-profile-logo]';
let PROFILE_NAME_FIELD = '[data-test-profile-customization-profile-name-field]';
let PROFILE_ID_FIELD = '[data-test-profile-customization-profile-slug-field]';
let COLOR_FIELD = '[data-test-profile-customization-color-field]';
let MANAGER = '[data-test-profile-customization-manager-address]';
let SAVE_DETAILS_BUTTON = '[data-test-profile-customization-save-details]';
let EDIT_BUTTON = '[data-test-profile-customization-edit]';
let COMPLETED_SELECTOR = '[data-test-profile-customization-is-complete]';

// fixtures for validation
const PROFILE_NAME_INVALID_INPUTS = [
  {
    value: '',
    errorMessage: 'This field is required',
  },
  {
    value: '   ',
    errorMessage: 'This field is required',
  },
  {
    value: 'a'.repeat(51),
    errorMessage: 'Cannot exceed 50 characters',
  },
];
const VALID_ID = 'abc123';
const PROFILE_ID_INVALID_INPUTS = [
  {
    value: '',
    errorMessage: 'This field is required',
  },
  {
    value: '  ',
    errorMessage: 'This field is required',
  },
  {
    value: 'an invalid id because of spaces',
    errorMessage:
      'Unique ID can only contain lowercase letters or numbers, no special characters',
  },
  {
    value: 'INVALIDCASING',
    errorMessage:
      'Unique ID can only contain lowercase letters or numbers, no special characters',
  },
  {
    value: '😤',
    errorMessage:
      'Unique ID can only contain lowercase letters or numbers, no special characters',
  },
  {
    value: 'thisisexactlyfiftyfivecharacterslongbutisotherwisevalid',
    errorMessage:
      'Unique ID cannot be more than 50 characters long. It is currently 55 characters long',
  },
];

let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';

module(
  'Integration | Component | card-pay/create-profile/profile-customization',
  function (hooks) {
    let layer2Service: Layer2TestWeb3Strategy;
    let workflowSession: WorkflowSession;

    setupRenderingTest(hooks);
    setupMirage(hooks);

    hooks.beforeEach(async function () {
      layer2Service = (
        this.owner.lookup('service:layer2-network') as Layer2Network
      ).strategy as Layer2TestWeb3Strategy;
      workflowSession = new WorkflowSession();

      let prepaidCardAddress = '0x123400000000000000000000000000000000abcd';

      layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createPrepaidCardSafe({
          address: prepaidCardAddress,
          owners: [layer2AccountAddress],
          prepaidCardOwner: layer2AccountAddress,
          issuer: layer2AccountAddress,
          spendFaceValue: 2324,
          reloadable: false,
          transferrable: false,
        }),
      ]);
      await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

      this.setProperties({
        onComplete: () => {
          this.set('isComplete', true);
        },
        onIncomplete: () => {
          this.set('isComplete', false);
        },
        isComplete: false,
        frozen: false,
        workflowSession,
      });

      await render(hbs`
        <CardPay::CreateProfileWorkflow::ProfileCustomization
          @onComplete={{this.onComplete}}
          @isComplete={{this.isComplete}}
          @onIncomplete={{this.onIncomplete}}
          @workflowSession={{this.workflowSession}}
          @frozen={{this.frozen}}
        />
      `);
    });

    test('It displays the default state correctly', async function (assert) {
      assert.dom(PREVIEW).exists();
      assert.dom(`${PREVIEW} ${PROFILE}`).containsText('Enter profile name');
      assert
        .dom(`${PREVIEW} ${PROFILE}`)
        .hasAttribute('data-test-profile', 'Enter profile name');
      assert.dom(PROFILE_NAME_FIELD).exists();
      assert.dom(PROFILE_ID_FIELD).exists();
      assert.dom(COLOR_FIELD).exists();
      assert.dom(SAVE_DETAILS_BUTTON).exists().isDisabled();
      assert.dom(MANAGER).containsText(layer2AccountAddress);
    });

    test('It validates the profile name field and updates the preview', async function (assert) {
      // enter valid profile id so we can check that the profile name being valid will make
      // the save details button enabled
      let profileSlugInput = `${PROFILE_ID_FIELD} input`;
      await fillIn(profileSlugInput, VALID_ID);
      await waitFor('[data-test-boxel-input-validation-state="valid"]');
      assert.dom(SAVE_DETAILS_BUTTON).isDisabled();

      let profileNameInput = `${PROFILE_NAME_FIELD} input`;

      // valid
      await fillIn(profileNameInput, 'HELLO!');
      assert.dom(profileNameInput).hasValue('HELLO!');
      assert
        .dom('[data-test-profile]')
        .hasAttribute('data-test-profile', 'HELLO!')
        .containsText('HELLO!');
      await waitFor('[data-test-boxel-input-validation-state="valid"]');
      assert.dom(SAVE_DETAILS_BUTTON).isEnabled();

      for (let invalidEntry of PROFILE_NAME_INVALID_INPUTS) {
        await fillIn(profileNameInput, invalidEntry.value);
        assert
          .dom(`${PROFILE_NAME_FIELD} [data-test-boxel-input-error-message]`)
          .containsText(invalidEntry.errorMessage);
        assert.dom(SAVE_DETAILS_BUTTON).isDisabled();
      }
    });

    test('It validates the profile ID field', async function (assert) {
      let profileNameInput = `${PROFILE_NAME_FIELD} input`;
      await fillIn(profileNameInput, 'HELLO!');
      assert.dom(profileNameInput).hasValue('HELLO!');
      assert
        .dom('[data-test-profile]')
        .hasAttribute('data-test-profile', 'HELLO!')
        .containsText('HELLO!');
      assert.dom(SAVE_DETAILS_BUTTON).isDisabled();

      let profileSlugInput = `${PROFILE_ID_FIELD} input`;
      await fillIn(profileSlugInput, VALID_ID);
      await waitFor('[data-test-boxel-input-validation-state="valid"]');
      assert.dom(SAVE_DETAILS_BUTTON).isEnabled();

      for (let invalidEntry of PROFILE_ID_INVALID_INPUTS) {
        await fillIn(profileSlugInput, invalidEntry.value);
        assert
          .dom(`${PROFILE_ID_FIELD} [data-test-boxel-input-error-message]`)
          .containsText(invalidEntry.errorMessage);
        assert.dom(SAVE_DETAILS_BUTTON).isDisabled();
      }
    });

    test('It validates a given id and displays the error message returned from the hub', async function (this: Context, assert) {
      this.server.create('profile', { slug: 'existing' });

      await fillIn(`${PROFILE_NAME_FIELD} input`, 'HELLO!');

      let profileSlugInput = `${PROFILE_ID_FIELD} input`;

      await fillIn(profileSlugInput, 'existing');
      await waitFor('[data-test-boxel-input-validation-state="invalid"]');
      assert
        .dom(`${PROFILE_ID_FIELD} [data-test-boxel-input-error-message]`)
        .containsText('This ID is already taken. Please choose another one');

      assert.dom(SAVE_DETAILS_BUTTON).isDisabled();

      await fillIn(profileSlugInput, 'unique');
      await waitFor('[data-test-boxel-input-validation-state="valid"]');

      assert.dom(SAVE_DETAILS_BUTTON).isEnabled();

      // www is hardcoded to be forbidden in mirage
      await fillIn(profileSlugInput, 'www');
      await waitFor('[data-test-boxel-input-validation-state="invalid"]');
      assert
        .dom(`${PROFILE_ID_FIELD} [data-test-boxel-input-error-message]`)
        .containsText('This ID is not allowed');

      assert.dom(SAVE_DETAILS_BUTTON).isDisabled();
    });

    test('It shows when there is an error validating id uniqueness', async function (this: Context, assert) {
      this.server.get('/profiles/validate-slug/:slug', function () {
        return new MirageResponse(500, {}, '');
      });

      await fillIn(`${PROFILE_NAME_FIELD} input`, 'HELLO!');

      let profileSlugInput = `${PROFILE_ID_FIELD} input`;

      await fillIn(profileSlugInput, 'existing');
      await waitFor('[data-test-boxel-input-validation-state="invalid"]');
      assert
        .dom(`${PROFILE_ID_FIELD} [data-test-boxel-input-error-message]`)
        .containsText('There was an error validating profile ID uniqueness');

      assert.dom(SAVE_DETAILS_BUTTON).isDisabled();
    });

    test('It updates the workflow session when saved', async function (assert) {
      assert.notOk(workflowSession.getValue('profileName'));
      assert.notOk(workflowSession.getValue('profileSlug'));
      assert.notOk(workflowSession.getValue('profileBgColor'));
      assert.notOk(workflowSession.getValue('profileTextColor'));

      let profileNameInput = `${PROFILE_NAME_FIELD} input`;
      await fillIn(profileNameInput, 'HELLO!');
      await blur(profileNameInput);

      let profileSlugInput = `${PROFILE_ID_FIELD} input`;
      await fillIn(profileSlugInput, VALID_ID);
      await blur(profileSlugInput);
      await waitFor('[data-test-boxel-input-validation-state="valid"]');

      await click(SAVE_DETAILS_BUTTON);

      assert.strictEqual(
        workflowSession.getValue<string>('profileName'),
        'HELLO!'
      );
      assert.strictEqual(
        workflowSession.getValue<string>('profileSlug'),
        VALID_ID
      );
      assert.ok(workflowSession.getValue<string>('profileBgColor'));
      assert.ok(workflowSession.getValue<string>('profileTextColor'));
    });

    test('It displays the memorialized state correctly', async function (assert) {
      let profileNameInput = `${PROFILE_NAME_FIELD} input`;
      await fillIn(profileNameInput, 'HELLO!');

      let profileSlugInput = `${PROFILE_ID_FIELD} input`;
      await fillIn(profileSlugInput, VALID_ID);
      // await new Promise((resolve) => {
      //   setTimeout(resolve, 5000);
      // });
      await blur(profileSlugInput);
      await waitFor('[data-test-boxel-input-validation-state="valid"]');
      assert.dom(SAVE_DETAILS_BUTTON).isEnabled();
      await click(SAVE_DETAILS_BUTTON);

      let bgColor = workflowSession.getValue<string>('profileBgColor')!;
      let textColor = workflowSession.getValue<string>('profileTextColor')!;

      await waitFor(COMPLETED_SELECTOR);
      assert.dom(COMPLETED_SELECTOR).exists();
      assert.dom(EDIT_BUTTON).exists();
      assert.dom(`${PREVIEW} ${PROFILE}`).containsText('HELLO!');
      assert
        .dom(`${PREVIEW} ${PROFILE_LOGO}`)
        .hasAttribute('data-test-profile-logo-background', bgColor);
      assert
        .dom(`${PREVIEW} ${PROFILE_LOGO}`)
        .hasAttribute('data-test-profile-logo-text-color', textColor);
      assert
        .dom(`${PREVIEW} ${PROFILE}`)
        .hasAttribute('data-test-profile', 'HELLO!');
      assert.dom(PROFILE_NAME_FIELD).doesNotExist();
      assert.dom(PROFILE_ID_FIELD).containsText(VALID_ID);
      assert.dom(COLOR_FIELD).containsText(bgColor);
      assert.dom(MANAGER).containsText(layer2AccountAddress);
    });
  }
);
