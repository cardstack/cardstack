import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import {
  click,
  fillIn,
  render,
  typeIn,
  waitFor,
  setupOnerror,
  settled,
} from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import { toWei } from 'web3-utils';
import BN from 'bn.js';
import sinon from 'sinon';
import {
  createDepotSafe,
  createSafeToken,
  generateMockAddress,
} from '@cardstack/web-client/utils/test-factories';
import { TransactionReceipt } from 'web3-core';
import { TransactionOptions } from '@cardstack/cardpay-sdk';
import { defer } from 'rsvp';

const startDaiAmountString = '100.1111111111111111';
let startDaiAmount = toWei(startDaiAmountString);

let layer2Strategy: Layer2TestWeb3Strategy;

module(
  'Integration | Component | card-pay/withdrawal-workflow/transaction-amount',
  function (hooks) {
    setupRenderingTest(hooks);
    let renderSubject!: () => Promise<void>;
    let session!: WorkflowSession;
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    let depotAddress = generateMockAddress();

    hooks.beforeEach(async function () {
      let layer2Service = this.owner.lookup('service:layer2-network');
      layer2Strategy = layer2Service.strategy as Layer2TestWeb3Strategy;

      // Simulate being connected on layer 2 -- prereq to converting to USD
      layer2Strategy.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createDepotSafe({
          address: depotAddress,
          tokens: [
            createSafeToken('DAI.CPXD', startDaiAmount),
            createSafeToken('CARD.CPXD', '0'),
          ],
        }),
      ]);
      await layer2Strategy.test__simulateAccountsChanged([
        layer2AccountAddress,
      ]);

      session = new WorkflowSession();
      session.setValue({
        withdrawalSafe: depotAddress,
        withdrawalToken: 'DAI.CPXD',
      });

      this.setProperties({
        session,
        onComplete: () => {},
        onIncomplete: () => {},
      });

      renderSubject = async () => {
        await render(hbs`
          <CardPay::WithdrawalWorkflow::TransactionAmount
            @workflowSession={{this.session}}
            @onComplete={{this.onComplete}}
            @onIncomplete={{this.onIncomplete}}
          />
        `);
      };
    });

    test('the funding source and balance are shown', async function (assert) {
      await renderSubject();
      assert.dom('[data-test-withdrawal-source]').containsText(depotAddress);
      assert
        .dom('[data-test-withdrawal-balance]')
        .containsText(`100.11 DAI.CPXD`);
    });

    test('the amount is marked invalid when a value is entered and then cleared', async function (assert) {
      await renderSubject();
      await fillIn('input', '50');
      await fillIn('input', '');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('This field is required');
    });

    test('the amount is marked invalid when the field loses focus', async function (assert) {
      await renderSubject();
      await click('input');
      await click('[data-test-withdrawal-source]');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('This field is required');
    });

    test('it accepts a well-formatted value that is less than or equal to the balance', async function (assert) {
      await renderSubject();
      await fillIn('input', '50');
      assert.dom('input').hasValue('50');
      assert.dom('input').doesNotHaveAria('invalid', 'true');
      assert.dom('[data-test-boxel-input-error-message]').doesNotExist();

      await fillIn('input', '50.5');
      assert.dom('input').hasValue('50.5');
      assert.dom('input').doesNotHaveAria('invalid', 'true');
      assert.dom('[data-test-boxel-input-error-message]').doesNotExist();

      await fillIn('input', '100');
      assert.dom('input').hasValue('100');
      assert.dom('input').doesNotHaveAria('invalid', 'true');
      assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
    });

    test('it accepts a value that is equal to the minimum', async function (assert) {
      await renderSubject();
      await fillIn('input', '0.5');
      assert.dom('input').doesNotHaveAria('invalid', 'true');
      assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
    });

    test('it rejects a well-formatted value that is lower than the minimum', async function (assert) {
      await renderSubject();
      await fillIn('input', '0.1');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('Amount must be at least 0.50 DAI.CPXD');
    });

    test('it rejects a well-formatted value this is greater than the balance', async function (assert) {
      await renderSubject();
      await fillIn('input', '150');
      assert.dom('input').hasValue('150');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('Insufficient balance in your account');

      await fillIn('input', '100.2');
      assert.dom('input').hasValue('100.2');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('Insufficient balance in your account');
    });

    test('it rejects a well-formatted value this is greater than the maximum', async function (assert) {
      let limit = await layer2Strategy.getWithdrawalLimits('DAI.CPXD');
      let balanceBiggerThanLimit = limit.max.add(new BN(toWei('2')));

      layer2Strategy.test__simulateRemoteAccountSafes(layer2AccountAddress, [
        createDepotSafe({
          address: depotAddress,
          tokens: [
            createSafeToken('DAI.CPXD', balanceBiggerThanLimit.toString()),
            createSafeToken('CARD.CPXD', '0'),
          ],
        }),
      ]);
      await layer2Strategy.safes.fetch();

      await renderSubject();
      await fillIn('input', '1500002');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('Amount must be below 1,500,000.00 DAI.CPXD');

      await fillIn('input', '1500000.1');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('Amount must be below 1,500,000.00 DAI.CPXD');
    });

    test('it strips whitespace from the beginning and end', async function (assert) {
      await renderSubject();
      await fillIn('input', ' 11 ');
      assert.dom('input').hasValue('11');
      assert.dom('input').doesNotHaveAria('invalid', 'true');
      assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
    });

    test('it rejects a well-formatted value that exceeds 18 decimal places', async function (assert) {
      await renderSubject();
      await fillIn('input', '1.1234567890123456789');
      assert.dom('input').hasValue('1.1234567890123456789');
      assert.dom('input').hasAria('invalid', 'true');
      assert
        .dom('[data-test-boxel-input-error-message]')
        .containsText('Amount must have less than 18 decimal points');
    });

    test('it ignores a minus sign', async function (assert) {
      await renderSubject();
      await typeIn('input', '-1.5');
      assert.dom('input').hasValue('1.5');
      assert.dom('input').doesNotHaveAria('invalid', 'true');
      assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
    });

    test('it ignores non-number characters', async function (assert) {
      await renderSubject();
      await typeIn('input', '11x');
      assert.dom('input').hasValue('11');
      assert.dom('input').doesNotHaveAria('invalid', 'true');
      assert.dom('[data-test-boxel-input-error-message]').doesNotExist();
    });

    test('it displays the correct error message if user rejects confirmation', async function (assert) {
      setupOnerror(function () {
        // Do nothing - Prevent test from crashing on error
      });
      let layer2Service = this.owner.lookup('service:layer2-network');
      sinon
        .stub(layer2Service, 'bridgeToLayer1')
        .throws(new Error('User rejected request'));
      await renderSubject();
      await fillIn('input', '5');
      await click('[data-test-withdrawal-transaction-amount] button');
      await waitFor('[data-test-withdrawal-transaction-amount-error]');
      assert
        .dom('[data-test-withdrawal-transaction-amount-error]')
        .containsText('It looks like you have canceled the request');
    });

    test('it displays the default error message', async function (assert) {
      setupOnerror(function () {
        // Do nothing - Prevent test from crashing on error
      });
      let layer2Service = this.owner.lookup('service:layer2-network');
      sinon.stub(layer2Service, 'bridgeToLayer1').throws(new Error('Huh?'));
      await renderSubject();
      await fillIn('input', '5');
      await click('[data-test-withdrawal-transaction-amount] button');
      await waitFor('[data-test-withdrawal-transaction-amount-error]');
      assert
        .dom('[data-test-withdrawal-transaction-amount-error]')
        .containsText(
          'There was a problem initiating the withdrawal of your tokens'
        );
    });

    test('it can complete and save necessary properties to the workflow session', async function (assert) {
      let layer2Service = this.owner.lookup('service:layer2-network');
      let layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;
      let layer1AccountAddress = '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
      layer1Service.test__simulateAccountsChanged(
        [layer1AccountAddress],
        'metamask'
      );

      let bridgeSpy = sinon.spy(layer2Service, 'bridgeToLayer1');

      this.set('onComplete', () => {
        this.set('isComplete', true);
      });

      await render(hbs`
      <CardPay::WithdrawalWorkflow::TransactionAmount
        @workflowSession={{this.session}}
        @isComplete={{this.isComplete}}
        @onComplete={{this.onComplete}}
        @onIncomplete={{this.onIncomplete}}
      />
    `);
      await fillIn('input', '5');
      await click('[data-test-withdrawal-transaction-amount] button');

      assert.ok(
        bridgeSpy.calledOnceWith(
          depotAddress,
          layer1AccountAddress,
          'DAI.CPXD',
          toWei('5'),
          sinon.match.has('onTxnHash', sinon.match.func)
        )
      );

      assert
        .dom('[data-test-withdrawal-transaction-amount-is-complete]')
        .isVisible();

      assert.ok(
        session.getValue('withdrawnAmount'),
        'persisted withdrawnAmount to Session'
      );
      assert.ok(
        session.getValue('layer2BlockHeightBeforeBridging'),
        'persisted layer2BlockHeightBeforeBridging to Session'
      );
      assert.ok(
        session.getValue('relayTokensTxnHash'),
        'persisted relayTokensTxnHash to Session'
      );
      assert.ok(
        session.getValue('relayTokensTxnReceipt'),
        'persisted relayTokensTxnReceipt to Session'
      );
    });

    test('it resumes the transaction to relay tokens if provided with a transaction hash', async function (assert) {
      let layer2Service = this.owner.lookup('service:layer2-network');
      let resumeSpy = sinon.spy(layer2Service, 'resumeBridgeToLayer1');
      session.setValue({
        withdrawnAmount: new BN(toWei('12')),
        relayTokensTxnHash: 'anystring',
        layer2BlockHeightBeforeBridging: 0,
      });

      await renderSubject();

      assert
        .dom('[data-test-withdrawal-transaction-amount-in-progress]')
        .isVisible();

      assert.ok(resumeSpy.calledOnceWith('anystring'));
    });

    test('it clears the transaction hash if the transaction is reverted', async function (assert) {
      setupOnerror(function () {
        // Do nothing - Prevent test from crashing on error
      });

      let receipt = defer<TransactionReceipt>();
      sinon
        .stub(layer2Strategy, 'bridgeToLayer1')
        .callsFake(function (
          _safeAddress: string,
          _receiverAddress: string,
          _tokenSymbol: 'DAI.CPXD' | 'CARD.CPXD' | 'DAI' | 'CARD',
          _amountInWei: string,
          { onTxnHash }: TransactionOptions
        ) {
          onTxnHash?.('test hash');
          return receipt.promise;
        });

      await render(hbs`
        <CardPay::WithdrawalWorkflow::TransactionAmount
          @workflowSession={{this.session}}
          @isComplete={{this.isComplete}}
          @onComplete={{this.onComplete}}
          @onIncomplete={{this.onIncomplete}}
        />
      `);
      await fillIn('input', '5');
      await click('[data-test-withdrawal-transaction-amount] button');

      assert.strictEqual(session.getValue('relayTokensTxnHash'), 'test hash');

      receipt.reject(new Error('Test reverted transaction'));
      await settled();

      assert.notOk(session.getValue('relayTokensTxnHash'));
    });
  }
);
