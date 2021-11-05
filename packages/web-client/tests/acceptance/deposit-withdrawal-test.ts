import { module, test } from 'qunit';
import { click, settled, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import {
  createDepotSafe,
  createSafeToken,
} from '@cardstack/web-client/utils/test-factories';

interface Context extends MirageTestContext {}

module('Acceptance | deposit and withdrawal', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  test('Depot balance is hidden when wallet is not connected', async function (assert) {
    await visit('/card-pay/deposit-withdrawal');

    assert.dom('[data-test-available-balances-section]').doesNotExist();
  });

  test('Depot balance is listed when wallet is connected and update when the account changes', async function (this: Context, assert) {
    let layer2Service: Layer2TestWeb3Strategy = this.owner.lookup(
      'service:layer2-network'
    ).strategy;
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        address: '0x123400000000000000000000000000000000abcd',
        owners: [layer2AccountAddress],
        tokens: [
          createSafeToken('DAI.CPXD', '14142298700000000000'),
          createSafeToken('CARD.CPXD', '567899100000000000000'),
        ],
      }),
    ]);
    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    await visit('/card-pay/deposit-withdrawal');

    assert
      .dom('[data-test-available-balances-section] h2')
      .hasText('Available Balances');
    assert
      .dom(
        '[data-test-available-balances-section] [data-test-workflow-button="deposit"]'
      )
      .exists();
    assert
      .dom('[data-test-card-pay-depot-header]')
      .containsText(`On ${c.layer2.fullName}`);

    assert
      .dom('[data-test-card-pay-depot-header]')
      .containsText('0x1234...abcd');
    assert.dom('[data-test-card-pay-depot-token-count]').containsText('2');
    assert
      .dom('[data-test-card-pay-depot-usd-total]')
      .containsText(`$116.41 USD`);
    assert
      .dom('[data-test-card-pay-depot-token="DAI.CPXD"]')
      .containsText('14.1422987 DAI.CPXD');
    assert
      .dom('[data-test-card-pay-depot-token="CARD.CPXD"]')
      .containsText('567.8991 CARD.CPXD');
    assert
      .dom('[data-test-card-pay-depot-token="DAI.CPXD"]')
      .containsText('$2.83 USD');
    assert
      .dom('[data-test-card-pay-depot-token="CARD.CPXD"]')
      .containsText('$113.58 USD');

    let secondAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6EbAAAA';
    layer2Service.test__simulateRemoteAccountSafes(secondAddress, [
      createDepotSafe({
        address: '0x123400000000000000000000000000000000dcba',
        owners: [secondAddress],
        tokens: [
          createSafeToken('DAI.CPXD', '0'),
          createSafeToken('CARD.CPXD', '238000000000000000000'),
        ],
      }),
    ]);
    await layer2Service.test__simulateAccountsChanged([secondAddress]);
    await settled();

    assert
      .dom('[data-test-card-pay-depot-header]')
      .containsText('0x1234...dcba');
    assert.dom('[data-test-card-pay-depot-token-count]').containsText('1');
    assert
      .dom('[data-test-card-pay-depot-usd-total]')
      .containsText('$47.60 USD');
    assert
      .dom('[data-test-card-pay-depot-token]')
      .containsText('238.00 CARD.CPXD');
    assert.dom('[data-test-card-pay-depot-token]').containsText('$47.60 USD');

    await click('[data-test-workflow-button="withdrawal"]');
    assert.dom('[data-test-boxel-thread-header] h2').hasText('Withdrawal');
  });

  test('Depot balance section when user has no depot', async function (this: Context, assert) {
    let layer2Service: Layer2TestWeb3Strategy = this.owner.lookup(
      'service:layer2-network'
    ).strategy;
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';

    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    await visit('/card-pay/deposit-withdrawal');

    assert.dom('[data-test-available-balances-section]').exists();
    assert.dom('[data-test-card-pay-depot]').doesNotExist();
    await click(
      '[data-test-available-balances-section] [data-test-workflow-button="deposit"]'
    );
    assert.dom('[data-test-boxel-thread-header] h2').containsText('Deposit');
  });

  test('Depot balance section when user has depot but no tokens', async function (this: Context, assert) {
    let layer2Service: Layer2TestWeb3Strategy = this.owner.lookup(
      'service:layer2-network'
    ).strategy;
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        address: '0x123400000000000000000000000000000000abcd',
        owners: [layer2AccountAddress],
      }),
    ]);
    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    await visit('/card-pay/deposit-withdrawal');

    assert.dom('[data-test-card-pay-depot]').exists();
    assert.dom('[data-test-card-pay-depot-token-count]').containsText('0');
    assert.dom('[data-test-card-pay-depot-usd-total]').containsText('$0.00');
    assert.dom('[data-test-card-pay-depot-token]').doesNotExist();
  });
});
