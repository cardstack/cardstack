import { module, test } from 'qunit';
import {
  click,
  currentURL,
  visit,
  waitFor,
  waitUntil,
  fillIn,
  settled,
} from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Layer2TestWeb3Strategy from '@cardstack/web-client/utils/web3-strategies/test-layer2';
import { toBN } from 'web3-utils';
import { DepotSafe } from '@cardstack/cardpay-sdk/sdk/safes';
import { setupMirage } from 'ember-cli-mirage/test-support';
import prepaidCardColorSchemes from '../../mirage/fixture-data/prepaid-card-color-schemes';
import prepaidCardPatterns from '../../mirage/fixture-data/prepaid-card-patterns';

function postableSel(milestoneIndex: number, postableIndex: number): string {
  return `[data-test-milestone="${milestoneIndex}"][data-test-postable="${postableIndex}"]`;
}

function epiloguePostableSel(postableIndex: number): string {
  return `[data-test-epilogue][data-test-postable="${postableIndex}"]`;
}

function milestoneCompletedSel(milestoneIndex: number): string {
  return `[data-test-milestone-completed][data-test-milestone="${milestoneIndex}"]`;
}

function cancelationPostableSel(postableIndex: number) {
  return `[data-test-cancelation][data-test-postable="${postableIndex}"]`;
}

module('Acceptance | issue prepaid card', function (hooks) {
  setupApplicationTest(hooks);
  setupMirage(hooks);

  hooks.beforeEach(function () {
    // TODO: fix typescript for mirage
    (this as any).server.db.loadData({
      prepaidCardColorSchemes,
      prepaidCardPatterns,
    });
  });

  test('Initiating workflow without wallet connections', async function (assert) {
    await visit('/card-pay');
    assert.equal(currentURL(), '/card-pay/balances');
    await click('[data-test-issue-prepaid-card-workflow-button]');

    let post = postableSel(0, 0);
    assert.dom(`${postableSel(0, 0)} img`).exists();
    assert.dom(postableSel(0, 0)).containsText('Hello, it’s nice to see you!');
    assert.dom(postableSel(0, 1)).containsText('Let’s issue a prepaid card.');

    assert
      .dom(postableSel(0, 2))
      .containsText(
        'Before we get started, please connect your xDai chain wallet via your Card Wallet mobile app.'
      );

    assert
      .dom(postableSel(0, 3))
      .containsText(
        'Once you have installed the app, open the app and add an existing wallet/account'
      );

    assert
      .dom(`${postableSel(0, 4)} [data-test-wallet-connect-loading-qr-code]`)
      .exists();

    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateWalletConnectUri();
    await waitFor('[data-test-wallet-connect-qr-code]');
    assert.dom('[data-test-wallet-connect-qr-code]').exists();

    // Simulate the user scanning the QR code and connecting their mobile wallet
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: toBN('250000000000000000000'),
      card: toBN('500000000000000000000'),
    });
    let depotAddress = '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666';
    let testDepot = {
      address: depotAddress,
      tokens: [
        {
          balance: '250000000000000000000',
          token: {
            symbol: 'DAI',
          },
        },
        {
          balance: '500000000000000000000',
          token: {
            symbol: 'CARD',
          },
        },
      ],
    };
    layer2Service.test__simulateDepot(testDepot as DepotSafe);
    await waitUntil(
      () => !document.querySelector('[data-test-wallet-connect-qr-code]')
    );
    // await waitFor(`${postableSel(0, 4)} [data-test-depot-balance]`);
    // assert
    //   .dom(`${postableSel(0, 4)} [data-test-depot-balance]`)
    //   .containsText('2500 DAI.CPXD');
    assert
      .dom(
        '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0x1826...6E44');

    await settled();

    assert
      .dom(milestoneCompletedSel(0))
      .containsText('xDai chain wallet connected');

    assert
      .dom(postableSel(1, 0))
      .containsText('First, you can choose the look and feel of your card');

    post = postableSel(1, 1);

    assert.dom('[data-test-layout-customization-form]').isVisible();
    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isDisabled();

    await fillIn('[data-test-layout-customization-name-input]', 'A');

    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isEnabled();

    await fillIn('[data-test-layout-customization-name-input]', '');
    assert
      .dom(`${post} [data-test-boxel-input-error-message]`)
      .containsText('required');
    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isDisabled();

    await fillIn('[data-test-layout-customization-name-input]', 'JJ');
    assert.dom(`${post} [data-test-boxel-input-error-message]`).doesNotExist();

    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isEnabled();

    let backgroundChoice = prepaidCardColorSchemes[4].background;
    let themeChoice = prepaidCardPatterns[2].patternUrl;

    await waitUntil(
      () =>
        document.querySelectorAll(
          '[data-test-customization-background-loading],[data-test-customization-theme-loading]'
        ).length === 0
    );

    assert
      .dom(
        `[data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-theme="${themeChoice}"]`
      )
      .doesNotExist();
    await click(
      `[data-test-customization-background-selection-item="${backgroundChoice}"]`
    );
    await click(
      `[data-test-customization-theme-selection-item="${themeChoice}"]`
    );

    assert
      .dom(
        `[data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-theme="${themeChoice}"]`
      )
      .exists();

    await click(
      `${post} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );

    assert.dom('[data-test-layout-customization-form]').isNotVisible();
    assert.dom('[data-test-layout-customization-display]').isVisible();

    assert
      .dom(
        `[data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-theme="${themeChoice}"]`
      )
      .exists();

    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .containsText('Edit')
      .isEnabled();

    await settled();

    assert.dom(milestoneCompletedSel(1)).containsText('Layout customized');

    assert.dom(postableSel(2, 0)).containsText('Nice choice!');
    assert
      .dom(postableSel(2, 1))
      .containsText('How do you want to fund your prepaid card?');

    post = postableSel(2, 2);
    // // funding-source card
    assert
      .dom('[data-test-funding-source-account] [data-test-account-address]')
      .hasText('0x1826...6E44');
    assert
      .dom('[data-test-funding-source-depot-outer] [data-test-account-address]')
      .hasText(depotAddress);
    assert
      .dom('[data-test-funding-source-dropdown="DAI.CPXD"]')
      .containsText('250.00 DAI');
    await click(
      `${post} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );
    assert.dom('[data-test-funding-source-dropdown="DAI.CPXD"]').doesNotExist();
    assert.dom('[data-test-funding-source-token]').containsText('250.00 DAI');

    assert
      .dom(postableSel(2, 3))
      .containsText('choose the face value of your prepaid card');
    // // face-value card
    // TODO verify and interact with face-value card default state
    await click(
      `${postableSel(
        2,
        4
      )} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );
    // TODO verify and interact with face-value card memorialized state

    await waitFor(milestoneCompletedSel(2));
    assert.dom(milestoneCompletedSel(2)).containsText('Face value chosen');

    assert
      .dom(postableSel(3, 0))
      .containsText('This is what your prepaid card will look like.');

    // // preview card
    // TODO verify and interact with preview card default state
    await click(
      `${postableSel(
        3,
        1
      )} [data-test-boxel-action-chin] [data-test-boxel-button]`
    );
    // TODO simulate transaction approval
    // TODO verify and interact with preview card memorialized state

    await waitFor(milestoneCompletedSel(3));
    assert.dom(milestoneCompletedSel(3)).containsText('Transaction confirmed');

    assert
      .dom(epiloguePostableSel(0))
      .containsText('Congratulations, you have created a prepaid card!');

    assert.dom(epiloguePostableSel(1)).containsText('Prepaid card issued');
    assert
      .dom(`${epiloguePostableSel(1)} [data-test-prepaid-card-issuer-name]`)
      .containsText('JJ');
    assert.dom(
      `${epiloguePostableSel(
        1
      )} [data-test-prepaid-card-background="${backgroundChoice}"][data-test-prepaid-card-theme="${themeChoice}"]`
    );

    await waitFor(epiloguePostableSel(2));

    assert
      .dom(epiloguePostableSel(2))
      .containsText('This is the remaining balance in your xDai chain wallet');

    // TODO: simulate depot balance
    // TODO: assert depot balance shown

    assert
      .dom(
        `${epiloguePostableSel(
          4
        )} [data-test-issue-prepaid-card-next-step="dashboard"]`
      )
      .exists();
    await click(
      `${epiloguePostableSel(
        4
      )} [data-test-issue-prepaid-card-next-step="dashboard"]`
    );
    assert.dom('[data-test-workflow-thread]').doesNotExist();
  });

  // test('Initiating workflow with layer 2 wallet already connected', async function (assert) {
  // });

  test('Disconnecting Layer 2 from within the workflow', async function (assert) {
    await visit('/card-pay');
    assert.equal(currentURL(), '/card-pay/balances');
    await click('[data-test-issue-prepaid-card-workflow-button]');

    let post = postableSel(0, 0);
    assert.dom(`${postableSel(0, 0)} img`).exists();
    assert.dom(postableSel(0, 0)).containsText('Hello, it’s nice to see you!');
    assert.dom(postableSel(0, 1)).containsText('Let’s issue a prepaid card.');

    assert
      .dom(postableSel(0, 2))
      .containsText(
        'Before we get started, please connect your xDai chain wallet via your Card Wallet mobile app.'
      );

    assert
      .dom(postableSel(0, 3))
      .containsText(
        'Once you have installed the app, open the app and add an existing wallet/account'
      );

    assert
      .dom(`${postableSel(0, 4)} [data-test-wallet-connect-loading-qr-code]`)
      .exists();

    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateWalletConnectUri();
    await waitFor('[data-test-wallet-connect-qr-code]');
    assert.dom('[data-test-wallet-connect-qr-code]').exists();

    // Simulate the user scanning the QR code and connecting their mobile wallet
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: toBN('250000000000000000000'),
      card: toBN('500000000000000000000'),
    });
    let testDepot = {
      address: '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666',
      tokens: [
        {
          balance: '250000000000000000000',
          token: {
            symbol: 'DAI',
          },
        },
        {
          balance: '500000000000000000000',
          token: {
            symbol: 'CARD',
          },
        },
      ],
    };
    layer2Service.test__simulateDepot(testDepot as DepotSafe);
    await waitUntil(
      () => !document.querySelector('[data-test-wallet-connect-qr-code]')
    );
    // await waitFor(`${postableSel(0, 4)} [data-test-depot-balance]`);
    // assert
    //   .dom(`${postableSel(0, 4)} [data-test-depot-balance]`)
    //   .containsText('2500 DAI.CPXD');
    assert
      .dom(
        '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0x1826...6E44');

    await settled();

    assert
      .dom(milestoneCompletedSel(0))
      .containsText('xDai chain wallet connected');

    assert
      .dom(postableSel(1, 0))
      .containsText('First, you can choose the look and feel of your card');

    post = postableSel(1, 1);

    assert.dom('[data-test-layout-customization-form]').isVisible();
    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isDisabled();
    await click(
      `[data-test-layer-2-wallet-card] [data-test-layer-2-wallet-disconnect-button]`
    );

    // test that all cta buttons are disabled
    let milestoneCtaButtonCount = Array.from(
      document.querySelectorAll(
        '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]'
      )
    ).length;
    assert
      .dom(
        '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:disabled'
      )
      .exists(
        { count: milestoneCtaButtonCount },
        'All cta buttons in milestones should be disabled'
      );
    assert
      .dom(cancelationPostableSel(0))
      .containsText(
        'It looks like your xDai chain wallet got disconnected. If you still want to deposit funds, please start again by connecting your wallet.'
      );
    assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');

    assert
      .dom('[data-test-issue-prepaid-card-workflow-canceled-restart]')
      .exists();
  });

  test('Disconnecting Layer 2 from outside the current tab (mobile wallet / other tabs)', async function (assert) {
    await visit('/card-pay');
    assert.equal(currentURL(), '/card-pay/balances');
    await click('[data-test-issue-prepaid-card-workflow-button]');

    let post = postableSel(0, 0);
    assert.dom(`${postableSel(0, 0)} img`).exists();
    assert.dom(postableSel(0, 0)).containsText('Hello, it’s nice to see you!');
    assert.dom(postableSel(0, 1)).containsText('Let’s issue a prepaid card.');

    assert
      .dom(postableSel(0, 2))
      .containsText(
        'Before we get started, please connect your xDai chain wallet via your Card Wallet mobile app.'
      );

    assert
      .dom(postableSel(0, 3))
      .containsText(
        'Once you have installed the app, open the app and add an existing wallet/account'
      );

    assert
      .dom(`${postableSel(0, 4)} [data-test-wallet-connect-loading-qr-code]`)
      .exists();

    let layer2Service = this.owner.lookup('service:layer2-network')
      .strategy as Layer2TestWeb3Strategy;
    layer2Service.test__simulateWalletConnectUri();
    await waitFor('[data-test-wallet-connect-qr-code]');
    assert.dom('[data-test-wallet-connect-qr-code]').exists();

    // Simulate the user scanning the QR code and connecting their mobile wallet
    let layer2AccountAddress = '0x182619c6Ea074C053eF3f1e1eF81Ec8De6Eb6E44';
    layer2Service.test__simulateAccountsChanged([layer2AccountAddress]);
    layer2Service.test__simulateBalances({
      defaultToken: toBN('250000000000000000000'),
      card: toBN('500000000000000000000'),
    });
    let testDepot = {
      address: '0xB236ca8DbAB0644ffCD32518eBF4924ba8666666',
      tokens: [
        {
          balance: '250000000000000000000',
          token: {
            symbol: 'DAI',
          },
        },
        {
          balance: '500000000000000000000',
          token: {
            symbol: 'CARD',
          },
        },
      ],
    };
    layer2Service.test__simulateDepot(testDepot as DepotSafe);
    await waitUntil(
      () => !document.querySelector('[data-test-wallet-connect-qr-code]')
    );
    // await waitFor(`${postableSel(0, 4)} [data-test-depot-balance]`);
    // assert
    //   .dom(`${postableSel(0, 4)} [data-test-depot-balance]`)
    //   .containsText('2500 DAI.CPXD');
    assert
      .dom(
        '[data-test-card-pay-layer-2-connect] [data-test-card-pay-connect-button]'
      )
      .hasText('0x1826...6E44');

    await settled();

    assert
      .dom(milestoneCompletedSel(0))
      .containsText('xDai chain wallet connected');

    assert
      .dom(postableSel(1, 0))
      .containsText('First, you can choose the look and feel of your card');

    post = postableSel(1, 1);

    assert.dom('[data-test-layout-customization-form]').isVisible();
    assert
      .dom(`${post} [data-test-boxel-action-chin] [data-test-boxel-button]`)
      .isDisabled();

    layer2Service.test__simulateDisconnectFromWallet();

    await waitFor('[data-test-issue-prepaid-card-workflow-canceled-cta]');
    // test that all cta buttons are disabled
    let milestoneCtaButtonCount = Array.from(
      document.querySelectorAll(
        '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]'
      )
    ).length;
    assert
      .dom(
        '[data-test-milestone] [data-test-boxel-action-chin] button[data-test-boxel-button]:disabled'
      )
      .exists(
        { count: milestoneCtaButtonCount },
        'All cta buttons in milestones should be disabled'
      );
    assert
      .dom(cancelationPostableSel(0))
      .containsText(
        'It looks like your xDai chain wallet got disconnected. If you still want to deposit funds, please start again by connecting your wallet.'
      );
    assert.dom(cancelationPostableSel(1)).containsText('Workflow canceled');
    assert
      .dom('[data-test-issue-prepaid-card-workflow-canceled-restart]')
      .exists();
  });
});
