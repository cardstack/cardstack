import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, fillIn, render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';

import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import { Response as MirageResponse } from 'ember-cli-mirage';
import { createPrepaidCardSafe } from '@cardstack/web-client/utils/test-factories';

interface Context extends MirageTestContext {}

// selectors
let PREVIEW = '[data-test-merchant-customization-merchant-preview]';
let MERCHANT = '[data-test-merchant]';
let MERCHANT_LOGO = '[data-test-merchant-logo]';
let MERCHANT_NAME_FIELD =
  '[data-test-merchant-customization-merchant-name-field]';
let MERCHANT_ID_FIELD = '[data-test-merchant-customization-merchant-id-field]';
let COLOR_FIELD = '[data-test-merchant-customization-color-field]';
let MANAGER = '[data-test-merchant-customization-manager-address]';
let SAVE_DETAILS_BUTTON = '[data-test-merchant-customization-save-details]';
let EDIT_BUTTON = '[data-test-merchant-customization-edit]';
let COMPLETED_SELECTOR = '[data-test-merchant-customization-is-complete]';

// fixtures for validation
const MERCHANT_NAME_INVALID_INPUTS = [
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
const MERCHANT_ID_INVALID_INPUTS = [
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
  'Integration | Component | card-pay/create-merchant/merchant-customization',
  function (hooks) {
    let layer2Service: Layer2TestWeb3Strategy;
    let workflowSession: WorkflowSession;

    setupRenderingTest(hooks);
    setupMirage(hooks);

    hooks.beforeEach(async function () {
      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
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
        <CardPay::CreateMerchantWorkflow::MerchantCustomization
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
      assert.dom(`${PREVIEW} ${MERCHANT}`).containsText('Enter profile name');
      assert
        .dom(`${PREVIEW} ${MERCHANT}`)
        .hasAttribute('data-test-merchant', 'Enter profile name');
      assert.dom(MERCHANT_NAME_FIELD).exists();
      assert.dom(MERCHANT_ID_FIELD).exists();
      assert.dom(COLOR_FIELD).exists();
      assert.dom(SAVE_DETAILS_BUTTON).exists().isDisabled();
      assert.dom(MANAGER).containsText(layer2AccountAddress);
    });

    test('It validates the merchant name field and updates the preview', async function (assert) {
      // enter valid merchant id so we can check that the merchant name being valid will make
      // the save details button enabled
      let merchantIdInput = `${MERCHANT_ID_FIELD} input`;
      await fillIn(merchantIdInput, VALID_ID);
      await waitFor('[data-test-boxel-input-validation-state="valid"]');
      assert.dom(SAVE_DETAILS_BUTTON).isDisabled();

      let merchantNameInput = `${MERCHANT_NAME_FIELD} input`;

      // valid
      await fillIn(merchantNameInput, 'HELLO!');
      assert.dom(merchantNameInput).hasValue('HELLO!');
      assert
        .dom('[data-test-merchant]')
        .hasAttribute('data-test-merchant', 'HELLO!')
        .containsText('HELLO!');
      await waitFor('[data-test-boxel-input-validation-state="valid"]');
      assert.dom(SAVE_DETAILS_BUTTON).isEnabled();

      for (let invalidEntry of MERCHANT_NAME_INVALID_INPUTS) {
        await fillIn(merchantNameInput, invalidEntry.value);
        assert
          .dom(`${MERCHANT_NAME_FIELD} [data-test-boxel-input-error-message]`)
          .containsText(invalidEntry.errorMessage);
        assert.dom(SAVE_DETAILS_BUTTON).isDisabled();
      }
    });

    test('It validates the merchant ID field', async function (assert) {
      let merchantNameInput = `${MERCHANT_NAME_FIELD} input`;
      await fillIn(merchantNameInput, 'HELLO!');
      assert.dom(merchantNameInput).hasValue('HELLO!');
      assert
        .dom('[data-test-merchant]')
        .hasAttribute('data-test-merchant', 'HELLO!')
        .containsText('HELLO!');
      assert.dom(SAVE_DETAILS_BUTTON).isDisabled();

      let merchantIdInput = `${MERCHANT_ID_FIELD} input`;
      await fillIn(merchantIdInput, VALID_ID);
      await waitFor('[data-test-boxel-input-validation-state="valid"]');
      assert.dom(SAVE_DETAILS_BUTTON).isEnabled();

      for (let invalidEntry of MERCHANT_ID_INVALID_INPUTS) {
        await fillIn(merchantIdInput, invalidEntry.value);
        assert
          .dom(`${MERCHANT_ID_FIELD} [data-test-boxel-input-error-message]`)
          .containsText(invalidEntry.errorMessage);
        assert.dom(SAVE_DETAILS_BUTTON).isDisabled();
      }
    });

    test('It validates a given id and displays the error message returned from the hub', async function (this: Context, assert) {
      this.server.create('merchant-info', { slug: 'existing' });

      await fillIn(`${MERCHANT_NAME_FIELD} input`, 'HELLO!');

      let merchantIdInput = `${MERCHANT_ID_FIELD} input`;

      await fillIn(merchantIdInput, 'existing');
      await waitFor('[data-test-boxel-input-validation-state="invalid"]');
      assert
        .dom(`${MERCHANT_ID_FIELD} [data-test-boxel-input-error-message]`)
        .containsText('This ID is already taken. Please choose another one');

      assert.dom(SAVE_DETAILS_BUTTON).isDisabled();

      await fillIn(merchantIdInput, 'unique');
      await waitFor('[data-test-boxel-input-validation-state="valid"]');

      assert.dom(SAVE_DETAILS_BUTTON).isEnabled();

      // www is hardcoded to be forbidden in mirage
      await fillIn(merchantIdInput, 'www');
      await waitFor('[data-test-boxel-input-validation-state="invalid"]');
      assert
        .dom(`${MERCHANT_ID_FIELD} [data-test-boxel-input-error-message]`)
        .containsText('This ID is not allowed');

      assert.dom(SAVE_DETAILS_BUTTON).isDisabled();
    });

    test('It shows when there is an error validating id uniqueness', async function (this: Context, assert) {
      this.server.get('/merchant-infos/validate-slug/:slug', function () {
        return new MirageResponse(500, {}, '');
      });

      await fillIn(`${MERCHANT_NAME_FIELD} input`, 'HELLO!');

      let merchantIdInput = `${MERCHANT_ID_FIELD} input`;

      await fillIn(merchantIdInput, 'existing');
      await waitFor('[data-test-boxel-input-validation-state="invalid"]');
      assert
        .dom(`${MERCHANT_ID_FIELD} [data-test-boxel-input-error-message]`)
        .containsText(
          'There was an error validating payment profile ID uniqueness'
        );

      assert.dom(SAVE_DETAILS_BUTTON).isDisabled();
    });

    test('It updates the workflow session when saved', async function (assert) {
      assert.notOk(workflowSession.getValue('merchantName'));
      assert.notOk(workflowSession.getValue('merchantId'));
      assert.notOk(workflowSession.getValue('merchantBgColor'));
      assert.notOk(workflowSession.getValue('merchantTextColor'));

      let merchantNameInput = `${MERCHANT_NAME_FIELD} input`;
      await fillIn(merchantNameInput, 'HELLO!');

      let merchantIdInput = `${MERCHANT_ID_FIELD} input`;
      await fillIn(merchantIdInput, VALID_ID);
      await waitFor('[data-test-boxel-input-validation-state="valid"]');

      await click(SAVE_DETAILS_BUTTON);

      assert.equal(workflowSession.getValue<string>('merchantName'), 'HELLO!');
      assert.equal(workflowSession.getValue<string>('merchantId'), VALID_ID);
      assert.ok(workflowSession.getValue<string>('merchantBgColor'));
      assert.ok(workflowSession.getValue<string>('merchantTextColor'));
    });

    test('It displays the memorialized state correctly', async function (assert) {
      let merchantNameInput = `${MERCHANT_NAME_FIELD} input`;
      await fillIn(merchantNameInput, 'HELLO!');

      let merchantIdInput = `${MERCHANT_ID_FIELD} input`;
      await fillIn(merchantIdInput, VALID_ID);
      await waitFor('[data-test-boxel-input-validation-state="valid"]');

      await click(SAVE_DETAILS_BUTTON);

      let bgColor = workflowSession.getValue<string>('merchantBgColor')!;
      let textColor = workflowSession.getValue<string>('merchantTextColor')!;

      assert.dom(COMPLETED_SELECTOR).exists();
      assert.dom(EDIT_BUTTON).exists();
      assert.dom(`${PREVIEW} ${MERCHANT}`).containsText('HELLO!');
      assert
        .dom(`${PREVIEW} ${MERCHANT_LOGO}`)
        .hasAttribute('data-test-merchant-logo-background', bgColor);
      assert
        .dom(`${PREVIEW} ${MERCHANT_LOGO}`)
        .hasAttribute('data-test-merchant-logo-text-color', textColor);
      assert
        .dom(`${PREVIEW} ${MERCHANT}`)
        .hasAttribute('data-test-merchant', 'HELLO!');
      assert.dom(MERCHANT_NAME_FIELD).doesNotExist();
      assert.dom(MERCHANT_ID_FIELD).containsText(VALID_ID);
      assert.dom(COLOR_FIELD).containsText(bgColor);
      assert.dom(MANAGER).containsText(layer2AccountAddress);
    });
  }
);
