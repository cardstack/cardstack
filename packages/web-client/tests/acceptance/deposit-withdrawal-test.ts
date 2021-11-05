import { module, test } from 'qunit';
import { click, settled, visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import { setupMirage } from 'ember-cli-mirage/test-support';
import { MirageTestContext } from 'ember-cli-mirage/test-support';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
// import { currentNetworkDisplayInfo as c } from '@cardstack/web-client/utils/web3-strategies/network-display-info';
import {
  createDepotSafe,
  createMerchantSafe,
  createPrepaidCardSafe,
  createSafeToken,
  getFilenameFromDid,
} from '@cardstack/web-client/utils/test-factories';

interface Context extends MirageTestContext {}

const EXAMPLE_DID = 'did:cardstack:1moVYMRNGv6E5Ca3t7aXVD2Yb11e4e91103f084a';

module('Acceptance | deposit and withdrawal', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  test('Depot balance is hidden when wallet is not connected', async function (assert) {
    await visit('/card-pay/deposit-withdrawal');

    assert.dom('[data-test-available-balances-section]').doesNotExist();
  });

  test('Depot and merchant balances are listed when wallet is connected and update when the account changes', async function (this: Context, assert) {
    let layer2Service: Layer2TestWeb3Strategy = this.owner.lookup(
      'service:layer2-network'
    ).strategy;
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    let merchantSafeAddress = '0x212619c6Ea074C053eF3f1e1eF81Ec8De6Eb6F33';
    layer2Service.test__simulateRemoteAccountSafes(layer2AccountAddress, [
      createDepotSafe({
        address: '0x123400000000000000000000000000000000abcd',
        owners: [layer2AccountAddress],
        tokens: [
          createSafeToken('DAI.CPXD', '14142298700000000000'),
          createSafeToken('CARD.CPXD', '567899100000000000000'),
        ],
      }),
      createMerchantSafe({
        address: merchantSafeAddress,
        owners: [layer2AccountAddress],
        infoDID: EXAMPLE_DID,
        tokens: [createSafeToken('CARD.CPXD', '467899100000000000000')],
      }),
      createPrepaidCardSafe({
        address: '0x123400000000000000000000000000000000abcd',
        owners: [layer2AccountAddress],
        spendFaceValue: 2324,
        prepaidCardOwner: layer2AccountAddress,
        issuer: layer2AccountAddress,
        reloadable: false,
        transferrable: false,
      }),
    ]);
    await layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);

    this.server.create('merchant-info', {
      id: await getFilenameFromDid(EXAMPLE_DID),
      name: 'Mandello',
      slug: 'mandello1',
      did: EXAMPLE_DID,
      color: '#00ffcc',
      'text-color': '#000000',
      'owner-address': layer2AccountAddress,
    });
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

    assert.dom('[data-test-safe-balances]').exists({ count: 2 });

    // assert
    //   .dom('[data-test-card-pay-depot-header]')
    //   .containsText(`On ${c.layer2.fullName}`);

    assert
      .dom('[data-test-safe-balances]:nth-of-type(1)')
      .containsText('0x1234...abcd');

    assert
      .dom(
        '[data-test-safe-balances]:nth-of-type(1) [data-test-safe-balances-token]'
      )
      .exists({ count: 2 });
    assert
      .dom(
        '[data-test-safe-balances]:nth-of-type(1) [data-test-safe-balances-token="DAI.CPXD"]'
      )
      .containsText('14.1422987 DAI.CPXD');
    assert
      .dom(
        '[data-test-safe-balances]:nth-of-type(1) [data-test-safe-balances-token="CARD.CPXD"]'
      )
      .containsText('567.8991 CARD.CPXD');

    assert
      .dom('[data-test-safe-balances]:nth-of-type(2)')
      .containsText('0x2126...6F33');

    assert
      .dom(
        '[data-test-safe-balances]:nth-of-type(2) [data-test-safe-balances-token]'
      )
      .exists({ count: 1 });
    assert
      .dom(
        '[data-test-safe-balances]:nth-of-type(2) [data-test-safe-balances-token="CARD.CPXD"]'
      )
      .containsText('467.8991 CARD.CPXD');
    // assert.dom('[data-test-card-pay-depot-token-count]').containsText('2');
    // assert
    //   .dom('[data-test-card-pay-depot-usd-total]')
    //   .containsText(`$116.41 USD`);
    // assert
    //   .dom('[data-test-card-pay-depot-token="DAI.CPXD"]')
    //   .containsText('14.1422987 DAI.CPXD');
    // assert
    //   .dom('[data-test-card-pay-depot-token="CARD.CPXD"]')
    //   .containsText('567.8991 CARD.CPXD');
    // assert
    //   .dom('[data-test-card-pay-depot-token="DAI.CPXD"]')
    //   .containsText('$2.83 USD');
    // assert
    //   .dom('[data-test-card-pay-depot-token="CARD.CPXD"]')
    //   .containsText('$113.58 USD');

    // assert
    //   .dom(
    //     `[data-test-card-pay-depot-address="${merchantSafeAddress}"] [data-test-card-pay-merchant-token="CARD.CPXD"]`
    //   )
    //   .containsText('467.8991 CARD.CPXD');

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

    // assert
    //   .dom('[data-test-card-pay-depot-header]')
    //   .containsText('0x1234...dcba');
    // assert.dom('[data-test-card-pay-depot-token-count]').containsText('1');
    // assert
    //   .dom('[data-test-card-pay-depot-usd-total]')
    //   .containsText('$47.60 USD');
    // assert
    //   .dom('[data-test-card-pay-depot-token]')
    //   .containsText('238.00 CARD.CPXD');
    // assert.dom('[data-test-card-pay-depot-token]').containsText('$47.60 USD');

    // await click('[data-test-workflow-button="withdrawal"]');
    // assert.dom('[data-test-boxel-thread-header] h2').hasText('Withdrawal');
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

    assert.dom('[data-test-safe-balances]').exists();
    // assert.dom('[data-test-card-pay-depot]').exists();
    // assert.dom('[data-test-card-pay-depot-token-count]').containsText('0');
    // assert.dom('[data-test-card-pay-depot-usd-total]').containsText('$0.00');
    // assert.dom('[data-test-card-pay-depot-token]').doesNotExist();
  });
});
