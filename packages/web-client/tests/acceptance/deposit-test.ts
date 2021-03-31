import { module, test } from 'qunit';
import { click, currentURL, visit, waitFor } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';

module('Acceptance | deposit', function (hooks) {
  setupApplicationTest(hooks);

  test('Making a deposit', async function (assert) {
    await visit('/');
    assert.equal(currentURL(), '/');
    await click('[data-test-cardstack-org-link="card-pay"]');
    assert.equal(currentURL(), '/card-pay');
    await click('[data-test-card-pay-layer-2-connect-button]');
    let layer2Service = this.owner.lookup('service:layer2-network');
    layer2Service.test__simulateWalletConnectUri();
    await waitFor('[data-test-wallet-connect-qr-code]');
    assert.dom('[data-test-wallet-connect-qr-code]').exists();

    // Simulate the user scanning the QR code and connecting their mobile wallet
    let accountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([accountAddress]);
    await waitFor('[data-test-layer2-account-id]');
    assert.dom('[data-test-layer2-account-id]').hasText(accountAddress);
    assert.dom('[data-test-wallet-connect-qr-code]').doesNotExist();

    // TODO: how does dapp get account names and imageBase64s from Cardstack Mobile?

    // assert account info shown
    // Account 1:
    // name: Gary’s Account 1
    // address: 0x59ab3A4056F211c249ca2D7AbC03A7164f5914Bc3
    // avatar:
    // Account 2 (selected / open):
    // name: Gary’s Account 2
    // address: 0xbEF4a7745A275f907da4B4ADAF75C4354ef2235Ac3
    // avatar:
    await click('[data-test-tab="deposit"]');

    assert.dom('[data-test-deposit-instructions]').exists();
    await click('[data-test-hide-button]');
    // // assert cardBot says "you need to connect two wallets"
    // await click "Wallet Connect" (Q: is this necessary if already wallet connected?)
    // assert MILESTONE REACHED "Mainnet Wallet connected"
    // await click("Create a new depot")
    // await select("DAI")
    // await click("Continue")
    // assert shows "How many tokens would you like to deposit?"

    // Assert "Unlock" is disabled
    // Assert "Deposit" is disabled
    // await fillIn "2500" DAI
    // await click("Unlock");
    // // simulate confirming via mobile wallet
    // await click("Deposit")
    // // simulate confirming via mobile wallet
    // assert MILESTONE REACHED "Deposited into Reserve Pool"

    // assert Sees "your token will be bridged to the xDai blockchain"
    // assert Step 2 progress shown
    // // simulate Step 2 complete
    // assert Step 3 progress shown
    // // simulate Step 3 complete
    // assert WORKFLOW COMPLETE "Tokens received on xDai"
    // assert sees "You have deposited 2,500 DAI into the CARD Protocol's Reserve Pool."
    // assert sees "This is the remaining balance in your Ethereum Mainnet wallet:"
    // await click("Return to dashboard")

    // ...
    // // assert Cards & Balances tab is active
    // // assert balance shows deposit just made
    // // assert only Dai CPXD balance shown
    // // assert no Prepaid Cards yet
  });
});
