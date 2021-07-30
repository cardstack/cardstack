import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, waitFor } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import WorkflowSession from '@cardstack/web-client/models/workflow/workflow-session';
import sinon from 'sinon';
import CardCustomization from '@cardstack/web-client/services/card-customization';
import { taskFor } from 'ember-concurrency-ts';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import { setupMirage } from 'ember-cli-mirage/test-support';
import prepaidCardColorSchemes from '../../../../../mirage/fixture-data/prepaid-card-color-schemes';
import prepaidCardPatterns from '../../../../../mirage/fixture-data/prepaid-card-patterns';
import { MirageTestContext } from 'ember-cli-mirage/test-support';

const USER_REJECTION_ERROR_MESSAGE =
  'It looks like you have canceled the request in your wallet. Please try again if you want to continue with this workflow.';
const TIMEOUT_ERROR_MESSAGE =
  'There was a problem creating your prepaid card. Please contact Cardstack support to find out the status of your transaction.';
const INSUFFICIENT_FUNDS_ERROR_MESSAGE = `Looks like there's no balance in your ${c.layer2.fullName} wallet to fund your selected prepaid card. Before you can continue, please add funds to your ${c.layer2.fullName} wallet by bridging some tokens from your ${c.layer1.fullName} wallet.`;
const DEFAULT_ERROR_MESSAGE =
  'There was a problem creating your prepaid card. Please try again if you want to continue with this workflow, or contact Cardstack support.';

interface Context extends MirageTestContext {}

module(
  'Integration | Component | card-pay/issue-prepaid-card-workflow/preview',
  function (hooks) {
    let layer2Service: Layer2TestWeb3Strategy;
    let cardCustomizationService: CardCustomization;

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

      let workflowSession = new WorkflowSession();
      workflowSession.updateMany({
        spendFaceValue: 100000,
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

    module('Test the sdk prepaid card creation calls', async function () {
      test('It shows the correct text in the creation button in the beginning and after errors', async function (assert) {
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
          .containsText('Retry');
      });
      test('It shows the correct error message for a user rejection', async function (assert) {
        sinon
          .stub(layer2Service, 'issuePrepaidCard')
          .throws(new Error('User rejected request'));

        await click('[data-test-issue-prepaid-card-button]');

        await waitFor('[data-test-issue-prepaid-card-error-message]');

        assert
          .dom('[data-test-issue-prepaid-card-error-message]')
          .containsText(USER_REJECTION_ERROR_MESSAGE);
      });

      test('It shows the correct error message for a timeout', async function (assert) {
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

      test('It shows the correct error message for the user not having enough of a token to create the card', async function (assert) {
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

      test('It shows a correct fallback error message', async function (assert) {
        sinon
          .stub(layer2Service, 'issuePrepaidCard')
          .throws(new Error('Not any matched error'));

        await click('[data-test-issue-prepaid-card-button]');

        await waitFor('[data-test-issue-prepaid-card-error-message]');

        assert
          .dom('[data-test-issue-prepaid-card-error-message]')
          .containsText(DEFAULT_ERROR_MESSAGE);
      });
    });

    test('It shows the fallback error message if the card customization service fails', async function (assert) {
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
