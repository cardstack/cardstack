import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Layer1TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer1';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { WorkflowSession } from '@cardstack/web-client/models/workflow';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import BN from 'bn.js';

module(
  'Integration | Component | card-pay/deposit-workflow/transaction-setup',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function () {
      let layer2Service = this.owner.lookup('service:layer2-network');
      let layer2Strategy = layer2Service.strategy as Layer2TestWeb3Strategy;

      // Simulate being connected on layer 2 -- prereq to converting to USD
      let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
      layer2Strategy.test__simulateAccountsChanged([layer2AccountAddress]);
    });

    test('incomplete card displays the correct data', async function (assert) {
      const session = new WorkflowSession();
      const layer1AccountAddress =
        '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
      const layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;

      layer1Service.test__simulateAccountsChanged(
        [layer1AccountAddress],
        'metamask'
      );
      layer1Service.test__simulateBalances({
        defaultToken: new BN('2141100000000000000'),
        dai: new BN('250500000000000000000'),
        card: new BN('10000000000000000000000'),
      });

      this.setProperties({
        session,
      });

      await render(hbs`
          <CardPay::DepositWorkflow::TransactionSetup
            @workflowSession={{this.session}}
            @onComplete={{noop}}
            @onIncomplete={{noop}}
          />
        `);

      assert
        .dom('[data-test-deposit-transaction-setup-is-complete]')
        .doesNotExist();
      assert
        .dom(`[data-test-deposit-transaction-setup-from-option]`)
        .exists({ count: 2 });
      assert
        .dom(
          `[data-test-deposit-transaction-setup-from-address] [data-test-account-name]`
        )
        .hasText(`${c.layer1.fullName} wallet`);
      assert
        .dom(
          `[data-test-deposit-transaction-setup-from-address] [data-test-account-address]`
        )
        .hasText(layer1AccountAddress);
      assert.dom(`[data-test-balance="DAI"]`).hasText('250.50 DAI');
      assert.dom(`[data-test-usd-balance="DAI"]`).hasText('$50.10 USD');
      assert.dom(`[data-test-balance="CARD"]`).hasText('10,000.00 CARD');
      assert.dom(`[data-test-usd-balance="CARD"]`).hasText('$2,000.00 USD');
      assert
        .dom(`[data-test-deposit-transaction-setup-to-wallet]`)
        .hasText(`${c.layer2.fullName} wallet`);
      assert
        .dom(
          `[data-test-deposit-transaction-setup-to-address] [data-test-account-address]`
        )
        .hasText('0x1826...6E44');
      assert
        .dom(
          `[data-test-deposit-transaction-setup-depot-address] [data-test-account-text]`
        )
        .hasText('New Depot');
    });

    test('zero balance tokens should not show loading indicator for USD balance', async function (assert) {
      const session = new WorkflowSession();
      const layer1AccountAddress =
        '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
      const layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;

      layer1Service.test__simulateAccountsChanged(
        [layer1AccountAddress],
        'metamask'
      );
      layer1Service.test__simulateBalances({
        defaultToken: new BN('2141100000000000000'),
        dai: new BN('0'),
        card: new BN('0'),
      });

      this.setProperties({
        session,
      });

      await render(hbs`
          <CardPay::DepositWorkflow::TransactionSetup
            @workflowSession={{this.session}}
            @onComplete={{noop}}
            @onIncomplete={{noop}}
          />
        `);

      assert.dom(`[data-test-balance="DAI"]`).hasText('0.00 DAI');
      assert
        .dom(`[data-test-usd-balance="DAI"] [data-test-usd-balance-loading]`)
        .doesNotExist();
      assert.dom(`[data-test-usd-balance="DAI"]`).containsText('$0.00 USD');
      assert.dom(`[data-test-balance="CARD"]`).hasText('0.00 CARD');
      assert
        .dom(`[data-test-usd-balance="CARD"] [data-test-usd-balance-loading]`)
        .doesNotExist();
      assert.dom(`[data-test-usd-balance="CARD"]`).containsText('$0.00 USD');
    });

    test('completed card displays the correct data', async function (assert) {
      const session = new WorkflowSession();
      const layer1AccountAddress =
        '0xaCD5f5534B756b856ae3B2CAcF54B3321dd6654Fb6';
      const layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;

      layer1Service.test__simulateAccountsChanged(
        [layer1AccountAddress],
        'metamask'
      );
      layer1Service.test__simulateBalances({
        defaultToken: new BN('2141100000000000000'),
        dai: new BN('250500000000000000000'),
        card: new BN('10000000000000000000000'),
      });

      session.setValue('depositSourceToken', 'DAI');

      this.setProperties({
        session,
        isComplete: true,
      });

      await render(hbs`
          <CardPay::DepositWorkflow::TransactionSetup
            @workflowSession={{this.session}}
            @isComplete={{this.isComplete}}
            @onComplete={{noop}}
            @onIncomplete={{noop}}
          />
        `);

      assert.dom('[data-test-deposit-transaction-setup-is-complete]').exists();
      assert
        .dom(`[data-test-deposit-transaction-setup-from-option]`)
        .doesNotExist();
      assert
        .dom(
          `[data-test-deposit-transaction-setup-from-address] [data-test-account-name]`
        )
        .hasText(`${c.layer1.fullName} wallet`);
      assert
        .dom(
          `[data-test-deposit-transaction-setup-from-address] [data-test-account-address]`
        )
        .hasText(layer1AccountAddress);
      assert
        .dom(
          '[data-test-deposit-transaction-setup-from-balance="DAI"] [data-test-balance-display-amount]'
        )
        .hasText('250.50 DAI');
      assert
        .dom(
          '[data-test-deposit-transaction-setup-from-balance="DAI"] [data-test-balance-display-usd-amount]'
        )
        .hasText('$50.10 USD');
      assert
        .dom(`[data-test-deposit-transaction-setup-to-wallet]`)
        .hasText(`${c.layer2.fullName} wallet`);
      assert
        .dom(
          `[data-test-deposit-transaction-setup-to-address] [data-test-account-address]`
        )
        .hasText('0x1826...6E44');
      assert
        .dom(
          `[data-test-deposit-transaction-setup-depot-address] [data-test-account-text]`
        )
        .hasText('New Depot');
    });

    test('interacting with the card', async function (assert) {
      const session = new WorkflowSession();
      const layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;

      layer1Service.test__simulateBalances({
        defaultToken: new BN('2141100000000000000'),
        dai: new BN('250500000000000000000'),
        card: new BN('10000000000000000000000'),
      });

      this.setProperties({
        onComplete: () => {
          this.set('isComplete', true);
        },
        onIncomplete: () => {
          this.set('isComplete', false);
        },
        isComplete: false,
        session,
      });

      await render(hbs`
          <CardPay::DepositWorkflow::TransactionSetup
            @workflowSession={{this.session}}
            @isComplete={{this.isComplete}}
            @onComplete={{this.onComplete}}
            @onIncomplete={{this.onIncomplete}}
          />
        `);

      assert
        .dom('[data-test-deposit-transaction-setup-is-complete]')
        .doesNotExist();
      assert
        .dom(`[data-test-deposit-transaction-setup-from-option="DAI"]`)
        .hasClass('radio-option--checked');
      assert
        .dom(`[data-test-deposit-transaction-setup-from-option="CARD"]`)
        .doesNotHaveClass('radio-option--checked');
      assert
        .dom('[data-test-deposit-transaction-setup] [data-test-boxel-button]')
        .hasText('Continue');
      assert
        .dom('[data-test-deposit-transaction-setup] [data-test-boxel-button]')
        .isNotDisabled();

      await click(
        `[data-test-deposit-transaction-setup] [data-test-boxel-button]`
      );
      assert
        .dom('[data-test-deposit-transaction-setup-from-balance="DAI"]')
        .containsText('250.50 DAI');
      assert
        .dom('[data-test-deposit-transaction-setup-from-balance="CARD"]')
        .doesNotExist();

      await click(
        `[data-test-deposit-transaction-setup] [data-test-boxel-button]`
      );
      assert
        .dom('[data-test-deposit-transaction-setup-is-complete]')
        .doesNotExist();
      assert
        .dom(`[data-test-deposit-transaction-setup-from-option]`)
        .exists({ count: 2 });

      await click(`[data-test-deposit-transaction-setup-from-option="CARD"]`);
      assert
        .dom(`[data-test-deposit-transaction-setup-from-option="CARD"]`)
        .hasClass('radio-option--checked');
      assert
        .dom(`[data-test-deposit-transaction-setup-from-option="DAI"]`)
        .doesNotHaveClass('radio-option--checked');

      await click(
        `[data-test-deposit-transaction-setup] [data-test-boxel-button]`
      );
      assert
        .dom('[data-test-deposit-transaction-setup-from-balance="CARD"]')
        .containsText('10,000.00 CARD');
      assert
        .dom('[data-test-deposit-transaction-setup-from-balance="DAI"]')
        .doesNotExist();
    });

    test('it displays validation message if user has 0 card and dai balances', async function (assert) {
      const session = new WorkflowSession();
      const layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;
      layer1Service.test__simulateBalances({
        defaultToken: new BN('2141100000000000000'),
        dai: new BN('0'),
        card: new BN('0'),
      });

      this.setProperties({
        session,
      });

      await render(hbs`
          <CardPay::DepositWorkflow::TransactionSetup
            @workflowSession={{this.session}}
            @onComplete={{noop}}
            @onIncomplete={{noop}}
          />
        `);

      assert
        .dom('[data-test-deposit-transaction-setup-from-option="DAI"] input')
        .isDisabled();
      assert
        .dom('[data-test-deposit-transaction-setup-from-option="CARD"] input')
        .isDisabled();
      assert
        .dom('[data-test-deposit-transaction-setup-validation]')
        .containsText('You need DAI or CARD tokens');
      assert
        .dom('[data-test-deposit-transaction-setup] [data-test-boxel-button]')
        .isDisabled();
    });

    test('it displays validation message if funds are undefined and 0', async function (assert) {
      const session = new WorkflowSession();
      const layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;

      layer1Service.test__simulateBalances({
        defaultToken: undefined,
        dai: undefined,
        card: new BN('0'),
      });

      this.setProperties({
        session,
      });

      await render(hbs`
          <CardPay::DepositWorkflow::TransactionSetup
            @workflowSession={{this.session}}
            @onComplete={{noop}}
            @onIncomplete={{noop}}
          />
        `);

      assert
        .dom('[data-test-deposit-transaction-setup-from-option="DAI"] input')
        .isDisabled();
      assert
        .dom('[data-test-deposit-transaction-setup-from-option="CARD"] input')
        .isDisabled();
      assert.dom('[data-test-deposit-transaction-setup-validation]').exists();
      assert
        .dom('[data-test-deposit-transaction-setup] [data-test-boxel-button]')
        .isDisabled();
    });

    test('it disables radio option with undefined balance', async function (assert) {
      const session = new WorkflowSession();
      const layer1Service = this.owner.lookup('service:layer1-network')
        .strategy as Layer1TestWeb3Strategy;
      layer1Service.test__simulateBalances({
        defaultToken: new BN('2141100000000000000'),
        dai: undefined,
        card: new BN('10000000000000000000000'),
      });

      this.setProperties({
        session,
      });

      await render(hbs`
          <CardPay::DepositWorkflow::TransactionSetup
            @workflowSession={{this.session}}
            @onComplete={{noop}}
            @onIncomplete={{noop}}
          />
        `);
      assert
        .dom('[data-test-deposit-transaction-setup-from-option="DAI"] input')
        .isDisabled();
      assert
        .dom('[data-test-deposit-transaction-setup-from-option="DAI"]')
        .doesNotHaveClass('radio-option--checked');
      assert
        .dom('[data-test-deposit-transaction-setup-from-option="CARD"] input')
        .isNotDisabled();
      assert
        .dom('[data-test-deposit-transaction-setup-from-option="CARD"]')
        .hasClass('radio-option--checked');
      assert
        .dom('[data-test-deposit-transaction-setup-validation]')
        .doesNotExist();
      assert
        .dom('[data-test-deposit-transaction-setup] [data-test-boxel-button]')
        .isNotDisabled();
    });
  }
);
