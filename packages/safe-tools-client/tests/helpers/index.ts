import { truncateMiddle } from '@cardstack/ember-shared/helpers/truncate-middle';
import { MockLocalStorage } from '@cardstack/safe-tools-client/utils/browser-mocks';
import { click, TestContext, visit } from '@ember/test-helpers';
import {
  setupApplicationTest as upstreamSetupApplicationTest,
  setupRenderingTest as upstreamSetupRenderingTest,
  setupTest as upstreamSetupTest,
} from 'ember-qunit';
import { generateTestingUtils } from 'eth-testing';
import { MetaMaskProvider } from 'eth-testing/lib/providers';
import { TestingUtils } from 'eth-testing/lib/testing-utils';

// This file exists to provide wrappers around ember-qunit's / ember-mocha's
// test setup functions. This way, you can easily extend the setup that is
// needed per test type.

type SetupTestOptions = Parameters<typeof upstreamSetupApplicationTest>[1];

// Hardhat default test account 1 (PK 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
export const TEST_ACCOUNT_1 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

// Hardhat default test account 2 (PK 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d)
export const TEST_ACCOUNT_2 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

declare module '@ember/test-helpers' {
  interface TestContext {
    mockWalletConnect: TestingUtils;
    mockMetaMask: TestingUtils;
    mockLocalStorage: MockLocalStorage;
  }
}

function setupApplicationTest(hooks: NestedHooks, options?: SetupTestOptions) {
  upstreamSetupApplicationTest(hooks, options);

  hooks.beforeEach(function (this: TestContext) {
    this.mockLocalStorage ||= new MockLocalStorage();
    this.owner.register('storage:local', this.mockLocalStorage, {
      instantiate: false,
    });

    this.mockWalletConnect = generateTestingUtils({
      providerType: 'WalletConnect',
    });

    this.mockWalletConnect.mockNotConnectedWallet();
    this.mockWalletConnect.mockAccounts([TEST_ACCOUNT_2]);
    this.mockWalletConnect.mockChainId(1);

    this.owner.register(
      'ethereum-provider:wallet-connect',
      this.mockWalletConnect.getProvider(),
      { instantiate: false }
    );

    this.mockMetaMask = generateTestingUtils({ providerType: 'MetaMask' });

    window.ethereum = this.mockMetaMask.getProvider() as MetaMaskProvider;

    this.mockMetaMask.mockNotConnectedWallet();
    this.mockMetaMask.mockAccounts([TEST_ACCOUNT_1]);
    this.mockMetaMask.mockChainId(1);
  });

  hooks.afterEach(function (this: TestContext) {
    this.mockMetaMask.clearAllMocks();
    this.mockWalletConnect.clearAllMocks();
    window.ethereum = undefined;
  });

  // Additional setup for application tests can be done here.
  //
  // For example, if you need an authenticated session for each
  // application test, you could do:
  //
  // hooks.beforeEach(async function () {
  //   await authenticateSession(); // ember-simple-auth
  // });
  //
  // This is also a good place to call test setup functions coming
  // from other addons:
  //
  // setupIntl(hooks); // ember-intl
  // setupMirage(hooks); // ember-cli-mirage
}

function setupRenderingTest(hooks: NestedHooks, options: SetupTestOptions) {
  upstreamSetupRenderingTest(hooks, options);

  // Additional setup for rendering tests can be done here.
}

function setupTest(hooks: NestedHooks, options: SetupTestOptions) {
  upstreamSetupTest(hooks, options);

  // Additional setup for unit tests can be done here.
}

export { setupApplicationTest, setupRenderingTest, setupTest };

export async function connectMetaMask(assert: Assert) {
  await visit('/schedule');
  await click('.connect-button__button');
  await click('[data-test-wallet-option="metamask"]');

  assert.dom(
    '.boxel-radio-option__input boxel-radio-option__input--hidden-radio boxel-radio-option__input--checked'
  );
  await click('[data-test-mainnet-connect-button]');

  assert
    .dom('.safe-tools__dashboard-schedule-control-panel-wallet-address')
    .hasText(truncateMiddle([TEST_ACCOUNT_1]));
}
