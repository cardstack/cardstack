import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, fillIn, find, render, waitUntil } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';

// selectors
let PREVIEW = '[data-test-merchant-customization-merchant-preview]';
let MERCHANT = '[data-test-merchant]';
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
      'Merchant ID can only contain lowercase alphabets and numbers',
  },
  {
    value: 'INVALIDCASING',
    errorMessage:
      'Merchant ID can only contain lowercase alphabets and numbers',
  },
  {
    value: '😤',
    errorMessage:
      'Merchant ID can only contain lowercase alphabets and numbers',
  },
  {
    value: 'thisisexactlyfiftyfivecharacterslongbutisotherwisevalid',
    errorMessage: 'Merchant ID must be at most 50 characters, currently 55',
  },
];

let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';

module(
  'Integration | Component | card-pay/create-merchant/merchant-customization',
  function (hooks) {
    let layer2Service: Layer2TestWeb3Strategy;
    let workflowSession: WorkflowSession;

    setupRenderingTest(hooks);

    hooks.beforeEach(async function () {
      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      workflowSession = new WorkflowSession();

      let prepaidCardAddress = '0x123400000000000000000000000000000000abcd';

      layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

      layer2Service.test__simulateAccountSafes(layer2AccountAddress, [
        {
          type: 'prepaid-card',
          createdAt: Date.now() / 1000,

          address: prepaidCardAddress,

          tokens: [],
          owners: [layer2AccountAddress],

          issuingToken: '0xTOKEN',
          spendFaceValue: 2324,
          prepaidCardOwner: layer2AccountAddress,
          hasBeenUsed: false,
          issuer: layer2AccountAddress,
          reloadable: false,
          transferrable: false,
        },
      ]);

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
      assert.dom(`${PREVIEW} ${MERCHANT}`).containsText('Enter merchant name');
      assert
        .dom(`${PREVIEW} ${MERCHANT}`)
        .hasAttribute('data-test-merchant', 'Enter merchant name');
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
      await waitUntil(
        () =>
          (find('[data-test-validation-state-input]') as HTMLElement).dataset
            .testValidationStateInput === 'valid'
      );
      assert.dom(SAVE_DETAILS_BUTTON).isDisabled();

      let merchantNameInput = `${MERCHANT_NAME_FIELD} input`;

      // valid
      await fillIn(merchantNameInput, 'HELLO!');
      assert.dom(merchantNameInput).hasValue('HELLO!');
      assert
        .dom('[data-test-merchant]')
        .hasAttribute('data-test-merchant', 'HELLO!')
        .containsText('HELLO!');
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
      await waitUntil(
        () =>
          (find('[data-test-validation-state-input]') as HTMLElement).dataset
            .testValidationStateInput === 'valid'
      );
      assert.dom(SAVE_DETAILS_BUTTON).isEnabled();

      for (let invalidEntry of MERCHANT_ID_INVALID_INPUTS) {
        await fillIn(merchantIdInput, invalidEntry.value);
        assert
          .dom(`${MERCHANT_ID_FIELD} [data-test-boxel-input-error-message]`)
          .containsText(invalidEntry.errorMessage);
        assert.dom(SAVE_DETAILS_BUTTON).isDisabled();
      }
    });

    // test('It validates uniqueness of a given id', async function (assert) {});

    test('It updates the workflow session when saved', async function (assert) {
      assert.notOk(workflowSession.state.merchantName);
      assert.notOk(workflowSession.state.merchantId);
      assert.notOk(workflowSession.state.merchantBgColor);
      assert.notOk(workflowSession.state.merchantTextColor);

      let merchantNameInput = `${MERCHANT_NAME_FIELD} input`;
      await fillIn(merchantNameInput, 'HELLO!');

      let merchantIdInput = `${MERCHANT_ID_FIELD} input`;
      await fillIn(merchantIdInput, VALID_ID);
      await waitUntil(
        () =>
          (find('[data-test-validation-state-input]') as HTMLElement).dataset
            .testValidationStateInput === 'valid'
      );

      await click(SAVE_DETAILS_BUTTON);

      assert.equal(workflowSession.state.merchantName, 'HELLO!');
      assert.equal(workflowSession.state.merchantId, VALID_ID);
      assert.ok(workflowSession.state.merchantBgColor);
      assert.ok(workflowSession.state.merchantTextColor);
    });

    test('It displays the memorialized state correctly', async function (assert) {
      let merchantNameInput = `${MERCHANT_NAME_FIELD} input`;
      await fillIn(merchantNameInput, 'HELLO!');

      let merchantIdInput = `${MERCHANT_ID_FIELD} input`;
      await fillIn(merchantIdInput, VALID_ID);
      await waitUntil(
        () =>
          (find('[data-test-validation-state-input]') as HTMLElement).dataset
            .testValidationStateInput === 'valid'
      );

      await click(SAVE_DETAILS_BUTTON);

      let bgColor = workflowSession.state.merchantBgColor;
      let textColor = workflowSession.state.merchantTextColor;

      assert.dom(COMPLETED_SELECTOR).exists();
      assert.dom(EDIT_BUTTON).exists();
      assert.dom(`${PREVIEW} ${MERCHANT}`).containsText('HELLO!');
      assert
        .dom(`${PREVIEW} ${MERCHANT}`)
        .hasAttribute('data-test-merchant-logo-background', bgColor);
      assert
        .dom(`${PREVIEW} ${MERCHANT}`)
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
