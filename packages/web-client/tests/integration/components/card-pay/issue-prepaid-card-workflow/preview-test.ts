import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, waitFor, waitUntil } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import sinon from 'sinon';
import CardCustomization from '@cardstack/web-client/services/card-customization';
import { taskFor } from 'ember-concurrency-ts';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { setupMirage } from 'ember-cli-mirage/test-support';
import prepaidCardColorSchemes from '../../../../../mirage/fixture-data/prepaid-card-color-schemes';
import prepaidCardPatterns from '../../../../../mirage/fixture-data/prepaid-card-patterns';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import { createMerchantSafe } from '@cardstack/web-client/utils/test-factories';
import BN from 'bn.js';
import { WorkflowStub } from '@cardstack/web-client/tests/stubs/workflow';
import { MerchantSafe } from '@cardstack/cardpay-sdk';

const USER_REJECTION_ERROR_MESSAGE =
  'It looks like you have canceled the request in your wallet. Please try again if you want to continue with this workflow.';
const TIMEOUT_ERROR_MESSAGE =
  'There was a problem creating your prepaid card. Please contact Cardstack support to find out the status of your transaction.';
const INSUFFICIENT_FUNDS_ERROR_MESSAGE = `Looks like there’s no balance in your ${c.layer2.fullName} wallet to fund your selected prepaid card. Before you can continue, please add funds to your ${c.layer2.fullName} wallet by bridging some tokens from your ${c.layer1.fullName} wallet.`;
const DEFAULT_ERROR_MESSAGE =
  'There was a problem creating your prepaid card. This may be due to a network issue, or perhaps you canceled the request in your wallet. Please try again if you want to continue with this workflow, or contact Cardstack support.';

interface Context extends MirageTestContext {}

module(
  'Integration | Component | card-pay/issue-prepaid-card-workflow/preview',
  function (hooks) {
    let layer2Service: Layer2TestWeb3Strategy;
    let cardCustomizationService: CardCustomization;
    let merchantSafe: MerchantSafe;

    setupRenderingTest(hooks);
    setupMirage(hooks);

    hooks.beforeEach(async function (this: Context) {
      this.server.db.loadData({
        prepaidCardColorSchemes,
        prepaidCardPatterns,
      });
      layer2Service = this.owner.lookup('service:layer2-network')
        .strategy as Layer2TestWeb3Strategy;
      cardCustomizationService = this.owner.lookup(
        'service:card-customization'
      ) as CardCustomization;

      merchantSafe = createMerchantSafe({
        address: '0xmerchantbAB0644ffCD32518eBF4924ba8666666',
        merchant: '0xprepaidDbAB0644ffCD32518eBF4924ba8666666',
        tokens: [],
        accumulatedSpendValue: 100,
      });

      let workflowSession = new WorkflowSession();
      workflowSession.setValue({
        spendFaceValue: 100000,
        prepaidFundingSafeAddress: merchantSafe.address,
        issuerName: 'Some name',
        colorScheme: {
          id: prepaidCardColorSchemes[0].id,
        },
        pattern: {
          id: prepaidCardPatterns[0].id,
        },
      });
      this.setProperties({
        onComplete: () => {},
        onIncomplete: () => {},
        isComplete: false,
        frozen: false,
        workflowSession,
      });

      await render(hbs`
      <CardPay::IssuePrepaidCardWorkflow::Preview
        @onComplete={{this.onComplete}}
        @isComplete={{this.isComplete}}
        @onIncomplete={{this.onIncomplete}}
        @workflowSession={{this.workflowSession}}
        @frozen={{this.frozen}}
      />
    `);
    });

    module('Test the sdk prepaid card creation calls', function () {
      test('it shows the correct text in the creation button in the beginning and after errors', async function (assert) {
        sinon
          .stub(layer2Service, 'issuePrepaidCard')
          .throws(new Error('An arbitrary error'));

        assert
          .dom('[data-test-issue-prepaid-card-button]')
          .containsText('Create');

        await click('[data-test-issue-prepaid-card-button]');

        await waitFor('[data-test-issue-prepaid-card-error-message]');
        assert
          .dom('[data-test-issue-prepaid-card-button]')
          .containsText('Try Again');
      });

      test('it cancels the workflow if hub authentication fails', async function (assert) {
        let workflow = new WorkflowStub(this.owner);
        workflow.attachWorkflow();
        this.set('workflowSession.workflow', workflow);

        sinon
          .stub(layer2Service, 'issuePrepaidCard')
          .throws(new Error('No valid auth token'));

        await click('[data-test-issue-prepaid-card-button]');
        await waitFor('[data-test-issue-prepaid-card-error-message]');

        assert
          .dom('[data-test-issue-prepaid-card-error-message]')
          .containsText(DEFAULT_ERROR_MESSAGE);

        this.set('frozen', true);
        assert.dom('[data-test-issue-prepaid-card-button]').isDisabled();

        assert.equal(workflow.isCanceled, true);
        assert.equal(workflow.cancelationReason, 'UNAUTHENTICATED');
      });

      test('it shows the correct error message for a user rejection', async function (assert) {
        sinon
          .stub(layer2Service, 'issuePrepaidCard')
          .throws(new Error('User rejected request'));

        await click('[data-test-issue-prepaid-card-button]');

        await waitFor('[data-test-issue-prepaid-card-error-message]');

        assert
          .dom('[data-test-issue-prepaid-card-error-message]')
          .containsText(USER_REJECTION_ERROR_MESSAGE);
      });

      test('it shows the correct error message for a timeout', async function (assert) {
        sinon
          .stub(layer2Service, 'issuePrepaidCard')
          .throws(
            new Error(
              'Transaction took too long to complete, waited 30 seconds'
            )
          );

        await click('[data-test-issue-prepaid-card-button]');

        await waitFor('[data-test-issue-prepaid-card-error-message]');

        assert
          .dom('[data-test-issue-prepaid-card-error-message]')
          .containsText(TIMEOUT_ERROR_MESSAGE);
      });

      test('it shows the correct error message for the user not having enough of a token to create the card', async function (assert) {
        sinon
          .stub(layer2Service, 'issuePrepaidCard')
          .throws(
            new Error(
              'Safe does not have enough balance to make prepaid card(s). The issuing token...'
            )
          );

        await click('[data-test-issue-prepaid-card-button]');

        await waitFor('[data-test-issue-prepaid-card-error-message]');

        assert
          .dom('[data-test-issue-prepaid-card-error-message]')
          .containsText(INSUFFICIENT_FUNDS_ERROR_MESSAGE);
      });

      test('it shows a correct fallback error message', async function (assert) {
        sinon
          .stub(layer2Service, 'issuePrepaidCard')
          .throws(new Error('Not any matched error'));

        await click('[data-test-issue-prepaid-card-button]');

        await waitFor('[data-test-issue-prepaid-card-error-message]');

        assert
          .dom('[data-test-issue-prepaid-card-error-message]')
          .containsText(DEFAULT_ERROR_MESSAGE);
      });

      test('it allow canceling and retrying after a while', async function (assert) {
        assert
          .dom('[data-test-issue-prepaid-card-button]')
          .containsText('Create');

        await click('[data-test-issue-prepaid-card-button]');
        assert
          .dom('[data-test-issue-prepaid-card-cancel-button]')
          .doesNotExist();
        await waitFor('[data-test-issue-prepaid-card-cancel-button]');
        layer2Service.test__simulateOnNonceForIssuePrepaidCardRequest(
          100000,
          merchantSafe.address,
          new BN('12345')
        );
        await click('[data-test-issue-prepaid-card-cancel-button]');
        assert
          .dom('[data-test-issue-prepaid-card-button]')
          .hasText('Try Again');
        await click('[data-test-issue-prepaid-card-button]');
        await waitUntil(() =>
          layer2Service.test__getNonceForIssuePrepaidCardRequest(
            100000,
            merchantSafe.address
          )
        );
        assert.equal(
          layer2Service.test__getNonceForIssuePrepaidCardRequest(
            100000,
            merchantSafe.address
          ),
          '12345',
          'The same nonce as was used for the first attempt is sent for the second'
        );
      });
    });

    test('it shows the fallback error message if the card customization service fails', async function (assert) {
      sinon
        .stub(
          taskFor(cardCustomizationService.createCustomizationTask),
          'perform'
        )
        .throws(new Error('Any error will do'));

      await click('[data-test-issue-prepaid-card-button]');

      await waitFor('[data-test-issue-prepaid-card-error-message]');

      assert
        .dom('[data-test-issue-prepaid-card-error-message]')
        .containsText(DEFAULT_ERROR_MESSAGE);
    });
  }
);
