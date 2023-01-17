import {
  ERC20ABI,
  GnosisSafeABI,
  ScheduledPaymentModuleABI,
} from '@cardstack/cardpay-sdk';
import { truncateMiddle } from '@cardstack/ember-shared/helpers/truncate-middle';
import { MockLocalStorage } from '@cardstack/safe-tools-client/utils/browser-mocks';
import { click, TestContext, visit } from '@ember/test-helpers';
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json';
import {
  setupApplicationTest as upstreamSetupApplicationTest,
  setupRenderingTest as upstreamSetupRenderingTest,
  setupTest as upstreamSetupTest,
} from 'ember-qunit';
import { generateTestingUtils } from 'eth-testing';
import { MetaMaskProvider } from 'eth-testing/lib/providers';
import { ContractUtils, TestingUtils } from 'eth-testing/lib/testing-utils';
// This file exists to provide wrappers around ember-qunit's / ember-mocha's
// test setup functions. This way, you can easily extend the setup that is
// needed per test type.

type SetupApplicationTestOptions = Parameters<
  typeof upstreamSetupApplicationTest
>[1];

type SetupRenderingTestOptions = Parameters<
  typeof upstreamSetupRenderingTest
>[1];

type SetupTestOptions = Parameters<typeof upstreamSetupTest>[1];

// Hardhat default test account 1 (PK 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
export const TEST_ACCOUNT_1 = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

// Hardhat default test account 2 (PK 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d)
export const TEST_ACCOUNT_2 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

interface MockSafeOptions {
  nativeBalance?: string;
  spModuleAddress?: string;
}

type CardstackTestingUtils = TestingUtils & {
  mockMainnet(): void;
  mockSafe(safeAddress: string, options?: MockSafeOptions): void;
  gnosisSafeContract: ContractUtils<typeof GnosisSafeABI>;
  spModuleContract: ContractUtils<typeof ScheduledPaymentModuleABI>;
};

declare module '@ember/test-helpers' {
  interface TestContext {
    mockWalletConnect: CardstackTestingUtils;
    mockMetaMask: TestingUtils;
    mockLocalStorage: MockLocalStorage;
  }
}

export const USDC_TOKEN_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const WETH_TOKEN_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const UNISWAP_V2_ADDRESS = '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc';

function setupApplicationTest(
  hooks: NestedHooks,
  options?: SetupApplicationTestOptions
) {
  upstreamSetupApplicationTest(hooks, options);

  hooks.beforeEach(function (this: TestContext) {
    this.mockLocalStorage ||= new MockLocalStorage();
    this.owner.register('storage:local', this.mockLocalStorage, {
      instantiate: false,
    });

    this.mockWalletConnect = generateTestingUtils({
      providerType: 'WalletConnect',
      verbose: false,
    }) as CardstackTestingUtils;

    this.mockWalletConnect.mockMainnet = () => {
      this.mockWalletConnect.mockChainId(1);
      const mockUsdcContract = this.mockWalletConnect.generateContractUtils(
        ERC20ABI,
        USDC_TOKEN_ADDRESS
      );
      mockUsdcContract.mockCall('decimals', ['6'], undefined, {
        persistent: true,
      });

      const mockWethContract = this.mockWalletConnect.generateContractUtils(
        ERC20ABI,
        WETH_TOKEN_ADDRESS
      );
      mockWethContract.mockCall('decimals', ['18'], undefined, {
        persistent: true,
      });

      const mockUniswapContract = this.mockWalletConnect.generateContractUtils(
        IUniswapV2Pair.abi,
        UNISWAP_V2_ADDRESS
      );
      mockUniswapContract.mockCall(
        'getReserves',
        ['1', '1', '10000'],
        undefined,
        {
          persistent: true,
        }
      );
    };

    this.mockWalletConnect.mockSafe = (
      safeAddress: string,
      options: MockSafeOptions = {}
    ) => {
      if (options.nativeBalance) {
        this.mockWalletConnect.mockBalance(safeAddress, '1000000000000000000');
      }
      this.mockWalletConnect.gnosisSafeContract =
        this.mockWalletConnect.generateContractUtils(
          GnosisSafeABI,
          safeAddress
        );
      this.mockWalletConnect.gnosisSafeContract.mockCall('VERSION', ['1.3.0']);

      if (options.spModuleAddress) {
        this.mockWalletConnect.spModuleContract =
          this.mockWalletConnect.generateContractUtils(
            ScheduledPaymentModuleABI,
            options.spModuleAddress
          );
      }
    };

    this.mockWalletConnect.mockNotConnectedWallet();
    this.mockWalletConnect.mockAccounts([TEST_ACCOUNT_2]);

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

function setupRenderingTest(
  hooks: NestedHooks,
  options?: SetupRenderingTestOptions
) {
  upstreamSetupRenderingTest(hooks, options);

  hooks.beforeEach(function (this: TestContext) {
    this.mockLocalStorage ||= new MockLocalStorage();
    this.owner.register('storage:local', this.mockLocalStorage, {
      instantiate: false,
    });
  });
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
  await click('[data-test-connect-wallet-button-modal]');

  assert
    .dom('.safe-tools__dashboard-schedule-control-panel-wallet-address')
    .hasText(truncateMiddle([TEST_ACCOUNT_1]));
}
