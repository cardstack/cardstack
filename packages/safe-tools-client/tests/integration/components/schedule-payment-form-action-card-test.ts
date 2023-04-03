import {
  ChainAddress,
  GasEstimationScenario,
  TokenDetail,
} from '@cardstack/cardpay-sdk';
import { Safe } from '@cardstack/safe-tools-client/services/safes';
import {
  ConfiguredScheduledPaymentFees,
  ServiceGasEstimationResult,
} from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import TokenToUsdService from '@cardstack/safe-tools-client/services/token-to-usd';
import TokensService from '@cardstack/safe-tools-client/services/tokens';
import WalletService from '@cardstack/safe-tools-client/services/wallet';
import Service from '@ember/service';
import {
  click,
  fillIn,
  find,
  render,
  TestContext,
  settled,
  waitUntil,
} from '@ember/test-helpers';
import {
  format,
  addDays,
  subDays,
  addMonths,
  subHours,
  isLastDayOfMonth,
} from 'date-fns';
import { task } from 'ember-concurrency-decorators';
import { selectChoose } from 'ember-power-select/test-support';
import { BigNumber, FixedNumber } from 'ethers';

import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';

import { setupRenderingTest } from '../../helpers';

import { exampleGasTokens } from '../../support/tokens';
import {
  chooseTime,
  chooseTomorrow,
  EXAMPLE_PAYEE,
  fillInSchedulePaymentFormWithValidInfo,
} from '../../support/ui-test-helpers';

class ConnectedWalletServiceStub extends WalletService {
  isConnected = true;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async switchNetwork(_chainId: number) {}
}

class DisconnectedWalletServiceStub extends WalletService {
  isConnected = false;
}

class ScheduledPaymentSDKServiceStub extends Service {
  async getFees(): Promise<ConfiguredScheduledPaymentFees> {
    return {
      fixedUSD: 0.25,
      percentage: 0.1,
    };
  }

  async getScheduledPaymentGasEstimation(
    _scenario: GasEstimationScenario,
    _tokenAddress: ChainAddress,
    _gasTokenAddress: ChainAddress
  ): Promise<ServiceGasEstimationResult> {
    return {
      gas: BigNumber.from(127864),
      gasRangeInGasTokenUnits: {
        normal: BigNumber.from('20000000'),
        high: BigNumber.from('40000000'),
        max: BigNumber.from('80000000'),
      },
    };
  }

  async getUsdToken(): Promise<TokenDetail | undefined> {
    return exampleGasTokens.find((gt) => gt.symbol === 'USDC');
  }

  async estimateSchedulePaymentInGasToken(
    _safeAddress: ChainAddress,
    _moduleAddress: ChainAddress,
    _tokenAddress: ChainAddress,
    _amount: BigNumber,
    _payeeAddress: ChainAddress,
    _executionGas: number,
    _maxGasPrice: string,
    _gasTokenAddress: ChainAddress,
    _salt: string,
    _payAt: number | null,
    _recurringDayOfMonth: number | null,
    _recurringUntil: number | null
  ): Promise<BigNumber> {
    const token = exampleGasTokens.find(
      (gt) => gt.address === _gasTokenAddress
    );
    return token
      ? BigNumber.from('10').pow(token.decimals).mul('10')
      : BigNumber.from('0');
  }
}

let enableUsdConversion = true;
class TokenToUsdServiceStub extends TokenToUsdService {
  // eslint-disable-next-line require-yield
  @task({ maxConcurrency: 1, enqueue: true }) *updateUsdcRate(
    tokenAddress: ChainAddress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    if (enableUsdConversion) {
      this.usdcToTokenRates.set(tokenAddress, {
        tokenInAddress: '0x0',
        tokenOutAddress: '0x0',
        tokenInDecimals: 6,
        tokenOutDecimals:
          tokenAddress === '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
            ? 6
            : 18,
        rate: FixedNumber.from(1),
      });
    } else {
      // eslint-disable-next-line ember/no-array-prototype-extensions
      this.usdcToTokenRates.clear();
    }
  }
}

let returnEmptySafes = false;
class SafeServiceStub extends Service {
  get safes(): Safe[] | undefined {
    let safes;
    if (!returnEmptySafes) {
      safes = [
        {
          address: '0x1A',
          spModuleAddress: '0x1A',
        },
      ];
    }
    return safes;
  }
  get currentSafe() {
    return this.safes?.[0];
  }
  get tokenBalances() {
    const usdcToken = exampleGasTokens.find((gt) => gt.symbol === 'USDC');
    return [
      {
        symbol: usdcToken?.name,
        balance: BigNumber.from('10')
          .pow(usdcToken?.decimals ?? 6)
          .mul('100'),
        decimals: usdcToken?.decimals,
        tokenAddress: usdcToken?.address,
      },
    ];
  }
}

let tokensService: TokensService;
module(
  'Integration | Component | schedule-payment-form-action-card',
  function (_hooks) {
    module('when the wallet is connected', function (hooks) {
      setupRenderingTest(hooks);

      hooks.beforeEach(function (this: TestContext) {
        this.owner.register(
          'service:scheduled-payment-sdk',
          ScheduledPaymentSDKServiceStub
        );
        this.owner.register('service:safes', SafeServiceStub);
        tokensService = this.owner.lookup('service:tokens');
        tokensService.stubGasTokens(exampleGasTokens);
        this.owner.register('service:token-to-usd', TokenToUsdServiceStub);
        this.owner.register('service:wallet', ConnectedWalletServiceStub);
      });

      test('it initializes the transaction token to undefined', async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);

        assert
          .dom(
            '.boxel-input-selectable-token-amount [data-test-boxel-input-group-select-accessory-trigger]'
          )
          .containsText('Choose token');
      });

      test('it initializes the gas token to usdc', async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);

        assert.dom('[data-test-gas-token-select]').containsText('USDC');
      });

      test('it shows tokens from the tokens service', async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        await click(
          '.boxel-input-selectable-token-amount [data-test-boxel-input-group-select-accessory-trigger]'
        );
        assert
          .dom('.boxel-input-selectable-token-amount__dropdown')
          .containsText('USDC');
        assert
          .dom('.boxel-input-selectable-token-amount__dropdown')
          .containsText('DAI');
      });

      test('it only enables the primary button when the form is valid', async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isDisabled();

        await click('[data-test-payment-type="one-time"]');

        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isDisabled();

        await chooseTomorrow('[data-test-boxel-input-date-trigger]');

        await chooseTime('[data-test-boxel-input-time-trigger]', 9, 0, 'am');

        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isDisabled();

        await fillIn('[data-test-payee-address-input]', EXAMPLE_PAYEE);

        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isDisabled();

        await fillIn('[data-test-amount-input] input', '15.0');

        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isDisabled();

        // Choose USDC for the transaction token
        await selectChoose(
          '[data-test-amount-input] [data-test-boxel-input-group-select-accessory-trigger]',
          'USDC'
        );

        // Choose USDC for the gas token
        await selectChoose('[data-test-gas-token-select]', 'USDC');

        // Button is enabled since max-gas defaults to normal
        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isEnabled();
        await click(
          '[data-test-max-gas-toggle] [data-toggle-group-option="high"]'
        );

        await fillIn('[data-test-payee-address-input]', 'Not an address');
        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isDisabled();
      });

      test('it disables submit button if usd conversion fails', async function (assert) {
        enableUsdConversion = false;
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);

        await click('[data-test-payment-type="one-time"]');
        await chooseTomorrow('[data-test-boxel-input-date-trigger]');
        await chooseTime('[data-test-boxel-input-time-trigger]', 9, 0, 'am');
        await fillIn('[data-test-payee-address-input]', EXAMPLE_PAYEE);
        await fillIn('[data-test-amount-input] input', '15.0');

        // Choose USDC for the transaction token
        await selectChoose(
          '[data-test-amount-input] [data-test-boxel-input-group-select-accessory-trigger]',
          'USDC'
        );

        // Choose USDC for the gas token
        await selectChoose('[data-test-gas-token-select]', 'USDC');

        // After choosing the token if there's an usd conversion the btn should be enabled
        // since gasPrice is set as normal by default, but we are failing the conversion
        // to match this test case
        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isDisabled();

        enableUsdConversion = true;
      });

      test('it can switch to one-time payment once switches to monthly', async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        assert.dom('[data-test-payment-date]').isNotVisible();
        assert.dom('[data-test-specific-payment-time]').isNotVisible();
        assert.dom('[data-test-recurring-day-of-month]').isNotVisible();
        assert.dom('[data-test-recurring-until]').isNotVisible();

        let paymentType = 'monthly';
        for (let i = 1; i <= 4; i++) {
          await click(`[data-test-payment-type="${paymentType}"]`);
          if (paymentType === 'monthly') {
            assert.dom('[data-test-payment-date]').isNotVisible();
            assert.dom('[data-test-specific-payment-time]').isNotVisible();
            assert.dom('[data-test-recurring-day-of-month]').isVisible();
            assert.dom('[data-test-recurring-until]').isVisible();

            paymentType = 'one-time';
          } else {
            assert.dom('[data-test-payment-date]').isVisible();
            assert.dom('[data-test-specific-payment-time]').isVisible();
            assert.dom('[data-test-recurring-day-of-month]').isNotVisible();
            assert.dom('[data-test-recurring-until]').isNotVisible();

            paymentType = 'monthly';
          }
        }
      });

      test(`it disables dates in the past (one-time payment)`, async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        const now = new Date();
        const yesterday = subDays(now, 1);
        await click(`[data-test-payment-type="one-time"]`);
        await click(`[data-test-input-payment-date]`);
        assert.dom(`[data-date="${format(now, 'yyyy-MM-dd')}"]`).isEnabled();
        assert
          .dom(`[data-date="${format(yesterday, 'yyyy-MM-dd')}"]`)
          .isDisabled();
      });

      test(`it disables dates beyond 1 year from now (one-time payment)`, async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        const now = new Date();
        const aYearAndADayFromNow = addDays(addMonths(now, 12), 1);
        await click(`[data-test-payment-type="one-time"]`);
        await click(`[data-test-input-payment-date]`);
        assert.dom(`[data-date="${format(now, 'yyyy-MM-dd')}"]`).isEnabled();
        while (
          this.element
            .querySelector('.ember-power-calendar-nav-title')
            ?.textContent?.trim() !==
          `${format(aYearAndADayFromNow, 'MMMM yyyy')}`
        ) {
          await click(`.ember-power-calendar-nav-control--next`);
        }
        assert
          .dom(`[data-date="${format(aYearAndADayFromNow, 'yyyy-MM-dd')}"]`)
          .isDisabled();
      });

      test(`it disables times before now (one-time payment)`, async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        const now = new Date();
        await click(`[data-test-payment-type="one-time"]`);
        await click(`[data-test-input-payment-date]`);
        await click(`[data-date="${format(now, 'yyyy-MM-dd')}"]`);
        await click(`[data-test-input-specific-payment-time]`);

        assert
          .dom(
            `[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="${format(
              now,
              'h'
            )}"]`
          )
          .exists();

        //No disabled times if the nextOneHour is 00:00 or 12:00
        if (now.getHours() !== 0 && now.getHours() !== 12) {
          assert
            .dom(
              `[data-test-boxel-hour-menu] .boxel-menu__item--disabled [data-test-boxel-menu-item-text="${format(
                subHours(now, 1),
                'h'
              )}"]`
            )
            .exists();
        }
      });

      test(`it disables until dates before the payment day of month (recurring)`, async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        const paymentDayOfMonth = 1;
        const now = new Date();
        let minMonthlyUntil;
        if (paymentDayOfMonth < now.getDate()) {
          minMonthlyUntil = new Date(
            addMonths(now, 2).setDate(paymentDayOfMonth)
          );
        } else {
          minMonthlyUntil = addMonths(now, 1);
        }

        await click(`[data-test-payment-type="monthly"]`);
        await click(`[data-test-input-recurring-day-of-month]`);
        await click(`[data-option-index="${paymentDayOfMonth - 1}"]`);
        await click(`[data-test-input-recurring-until]`);

        while (
          this.element
            .querySelector('.ember-power-calendar-nav-title')
            ?.textContent?.trim() !== `${format(minMonthlyUntil, 'MMMM yyyy')}`
        ) {
          await click(`.ember-power-calendar-nav-control--previous`);
        }
        assert
          .dom(`[data-date="${format(minMonthlyUntil, 'yyyy-MM-dd')}"]`)
          .isEnabled();

        if (minMonthlyUntil.getDate() === 1) {
          await click(`.ember-power-calendar-nav-control--previous`);
        }

        const disabledDate = subDays(minMonthlyUntil, 1);
        assert
          .dom(`[data-date="${format(disabledDate, 'yyyy-MM-dd')}"]`)
          .isDisabled();
      });

      test(`it disables until dates after 1 year from now (recurring)`, async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        const paymentDayOfMonth = 1;
        const now = new Date();
        const maxMonthlyUntil = new Date(addMonths(now, 12));

        await click(`[data-test-payment-type="monthly"]`);
        await click(`[data-test-input-recurring-day-of-month]`);
        await click(`[data-option-index="${paymentDayOfMonth - 1}"]`);
        await click(`[data-test-input-recurring-until]`);

        while (
          this.element
            .querySelector('.ember-power-calendar-nav-title')
            ?.textContent?.trim() !== `${format(maxMonthlyUntil, 'MMMM yyyy')}`
        ) {
          await click(`.ember-power-calendar-nav-control--next`);
        }
        assert
          .dom(`[data-date="${format(maxMonthlyUntil, 'yyyy-MM-dd')}"]`)
          .isEnabled();

        if (isLastDayOfMonth(maxMonthlyUntil)) {
          await click(`.ember-power-calendar-nav-control--next`);
        }

        const disabledDate = addDays(maxMonthlyUntil, 1);
        assert
          .dom(`[data-date="${format(disabledDate, 'yyyy-MM-dd')}"]`)
          .isDisabled();
      });

      test('when the network changes, the selected gas token is updated if necessary', async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        await selectChoose('[data-test-gas-token-select]', 'USDC');
        const exampleGasTokens2: TokenDetail[] = [
          exampleGasTokens.find((t) => t.symbol === 'USDC') as TokenDetail,
          {
            name: 'Monavale',
            symbol: 'MONA',
            decimals: 18,
            address: '0x6968105460f67c3BF751bE7C15f92F5286Fd0CE5',
            logoURI: 'https://wallet-asset.matic.network/img/tokens/mona.svg',
          },
        ];
        tokensService.stubGasTokens(exampleGasTokens2);
        await settled();
        assert.dom('[data-test-gas-token-select]').containsText('USDC');
        const exampleGasTokens3: TokenDetail[] = [
          exampleGasTokens.find((t) => t.symbol === 'CARD') as TokenDetail,
          exampleGasTokens2.find((t) => t.symbol === 'MONA') as TokenDetail,
        ];
        tokensService.stubGasTokens(exampleGasTokens3);
        await settled();
        assert.dom('[data-test-gas-token-select]').containsText('USDC');
      });

      test('when the network changes, the selected payment token is updated if needed', async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        await selectChoose(
          '[data-test-amount-input] [data-test-boxel-input-group-select-accessory-trigger]',
          'USDC'
        );
        const networkService = this.owner.lookup('service:network');
        networkService.onChainChanged(137);
        await settled();
        assert
          .dom(
            '[data-test-amount-input] [data-test-boxel-input-group-select-accessory-trigger]'
          )
          .containsText('Choose token');
      });

      test('configured fees for the current network are shown under max gas options', async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        assert
          .dom('.schedule-payment-form-action-card__details')
          .containsText('Cardstack charges $0.25 USD and 0.1%');
      });

      test(`it displays the create safe instruction if user has no safes`, async function (assert) {
        returnEmptySafes = true;
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);

        assert
          .dom('.schedule-payment-form-prerequisite-step__icons')
          .isVisible();
        assert
          .dom('.schedule-payment-form-prerequisite-step__text')
          .isVisible();
        assert
          .dom('.schedule-payment-form-prerequisite-step__text')
          .containsText('Step 2');
        returnEmptySafes = false;
      });

      test('calculated fees are shown under at the bottom of the form once valid', async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        await fillInSchedulePaymentFormWithValidInfo({
          paymentTokenName: 'WETH',
        });
        assert
          .dom('[data-test-summary-recipient-receives]')
          .containsText('15 WETH');
        await waitUntil(() => {
          return find(
            '[data-test-summary-recipient-receives]'
          )?.textContent?.includes('$ 15.00');
        });
        assert
          .dom('[data-test-summary-recipient-receives]')
          .containsText('$ 15.00');

        await waitUntil(() => {
          return find(
            '[data-test-summary-estimated-gas]'
          )?.textContent?.includes('20 USDC');
        });
        assert.dom('[data-test-summary-estimated-gas]').containsText('20 USDC');
        assert.dom('[data-test-summary-estimated-gas]').containsText('$ 20.00');
        await waitUntil(() => {
          return find('[data-test-summary-fixed-fee]')?.textContent?.includes(
            '0.25 USDC'
          );
        });
        assert.dom('[data-test-summary-fixed-fee]').containsText('0.25 USDC');
        assert.dom('[data-test-summary-fixed-fee]').containsText('$ 0.25');
        assert
          .dom('[data-test-summary-variable-fee]')
          .containsText('0.015 WETH');
        assert.dom('[data-test-summary-variable-fee]').containsText('$ 0.01');
      });

      test('max gas cost ranges should have different values', async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        await fillInSchedulePaymentFormWithValidInfo({
          paymentTokenName: 'WETH',
        });
        await waitUntil(() => {
          return !find(
            '[data-test-max-gas-toggle] [data-toggle-group-option="normal"]'
          )?.textContent?.includes('Loading gas price');
        });
        assert
          .dom('[data-test-max-gas-toggle] [data-toggle-group-option="normal"]')
          .containsText('20 USDC');
        assert
          .dom('[data-test-max-gas-toggle] [data-toggle-group-option="high"]')
          .containsText('40 USDC');
        assert
          .dom('[data-test-max-gas-toggle] [data-toggle-group-option="max"]')
          .containsText('80 USDC');
      });

      test('it disables submit button if gas token balance insufficient', async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isDisabled();

        await click('[data-test-payment-type="one-time"]');

        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isDisabled();

        await chooseTomorrow('[data-test-boxel-input-date-trigger]');

        await chooseTime('[data-test-boxel-input-time-trigger]', 9, 0, 'am');

        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isDisabled();

        await fillIn('[data-test-payee-address-input]', EXAMPLE_PAYEE);

        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isDisabled();

        await fillIn('[data-test-amount-input] input', '15.0');

        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isDisabled();

        // Choose USDC for the transaction token
        await selectChoose(
          '[data-test-amount-input] [data-test-boxel-input-group-select-accessory-trigger]',
          'USDC'
        );

        // Choose WETH for the gas token
        // Safe doesn't have weth balance
        await selectChoose('[data-test-gas-token-select]', 'WETH');

        // Button is enabled since max-gas defaults to normal
        assert
          .dom('[data-test-schedule-payment-form-submit-button]')
          .isDisabled();
        await click(
          '[data-test-max-gas-toggle] [data-toggle-group-option="high"]'
        );

        assert
          .dom('.schedule-payment-form-action-card__fees-value-error-message')
          .exists();
      });
    });

    module('when the wallet is not connected', function (hooks) {
      setupRenderingTest(hooks);

      hooks.beforeEach(function (this: TestContext) {
        tokensService = this.owner.lookup('service:tokens');
        tokensService.stubGasTokens(exampleGasTokens);
        this.owner.register('service:wallet', DisconnectedWalletServiceStub);
      });

      test('it renders the form inputs disabled', async function (assert) {
        await render(hbs`
          <SchedulePaymentFormActionCard />
        `);
        assert
          .dom('.schedule-payment-form-action-card input')
          .hasAttribute('disabled');
      });
    });
  }
);
