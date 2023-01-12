import { SelectableToken } from '@cardstack/boxel/components/boxel/input/selectable-token';
import {
  ChainAddress,
  GasEstimationScenario,
  TokenDetail,
} from '@cardstack/cardpay-sdk';
import {
  ConfiguredScheduledPaymentFees,
  ExecutionGasEstimationResult,
} from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import TokensService from '@cardstack/safe-tools-client/services/tokens';
import Service from '@ember/service';
import {
  click,
  fillIn,
  render,
  TestContext,
  settled,
} from '@ember/test-helpers';
import { tracked } from '@glimmer/tracking';
import { format, subDays, addMonths, addHours, subHours } from 'date-fns';
import { task } from 'ember-concurrency';
import { selectChoose } from 'ember-power-select/test-support';

import { BigNumber } from 'ethers';
import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';
import { TrackedMap } from 'tracked-built-ins';

import { setupRenderingTest } from '../helpers';

import { exampleGasTokens } from '../support/tokens';
import {
  chooseTime,
  chooseTomorrow,
  EXAMPLE_PAYEE,
} from '../support/ui-test-helpers';

class WalletServiceStub extends Service {
  isConnected = true;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async switchNetwork(_chainId: number) {}
}

class ScheduledPaymentSDKServiceStub extends Service {
  async getScheduledPaymentGasEstimation(
    _scenario: GasEstimationScenario,
    _token: SelectableToken,
    _gasToken: SelectableToken
  ): Promise<ExecutionGasEstimationResult> {
    const gas = BigNumber.from('15000');
    const gasRangeInWei = {
      standard: BigNumber.from('15000'),
    };
    const gasRangeInUSD = {
      standard: BigNumber.from('2'),
    };
    const priceWeiInGasToken = '100';
    return {
      gas,
      gasRangeInGasTokenWei: {
        normal: gasRangeInWei.standard.mul(priceWeiInGasToken).mul(2),
        high: gasRangeInWei.standard.mul(priceWeiInGasToken).mul(4),
        max: gasRangeInWei.standard.mul(priceWeiInGasToken).mul(6),
      },
      gasRangeInUSD: {
        normal: gasRangeInUSD.standard.mul(2),
        high: gasRangeInUSD.standard.mul(4),
        max: gasRangeInUSD.standard.mul(6),
      },
    };
  }
  async getFees(): Promise<ConfiguredScheduledPaymentFees> {
    return {
      fixedUSD: 0.25,
      percentage: 0.1,
    };
  }
}

class TokenToUsdServiceStub extends Service {
  @tracked usdConverters = new TrackedMap<
    string,
    (amountInWei: BigNumber) => BigNumber
  >();

  // eslint-disable-next-line require-yield
  @task({ maxConcurrency: 1, enqueue: true }) *updateUsdConverter(
    tokenAddress: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    this.usdConverters.set(tokenAddress, (amountInSmallestUnit: BigNumber) => {
      const convertedNum = amountInSmallestUnit.mul(2);
      return BigNumber.from(convertedNum);
    });
  }

  toUsd(tokenAddress: string, amount: BigNumber): BigNumber | undefined {
    return this.usdConverters.get(tokenAddress)?.(amount);
  }
}

let tokensService: TokensService;
module(
  'Integration | Component | schedule-payment-form-action-card',
  function (hooks) {
    setupRenderingTest(hooks);

    hooks.beforeEach(function (this: TestContext) {
      this.owner.register(
        'service:scheduled-payment-sdk',
        ScheduledPaymentSDKServiceStub
      );
      this.owner.register('service:token-to-usd', TokenToUsdServiceStub);
      tokensService = this.owner.lookup('service:tokens');
      tokensService.stubGasTokens(exampleGasTokens);
      this.owner.register('service:wallet', WalletServiceStub);
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

      await fillIn('[data-test-amount-input] input', '15.5');

      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();

      // Choose USDC for the transaction token
      await selectChoose(
        '[data-test-amount-input] [data-test-boxel-input-group-select-accessory-trigger]',
        'USDC'
      );

      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();

      // Choose USDC for the gas token
      await selectChoose('[data-test-gas-token-select]', 'USDC');

      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();

      await click(
        '[data-test-max-gas-toggle] [data-toggle-group-option="normal"]'
      );

      // TODO: assrt existence of summary data
      await this.pauseTest();

      assert.dom('[data-test-schedule-payment-form-submit-button]').isEnabled();

      await fillIn('[data-test-payee-address-input]', 'Not an address');
      assert
        .dom('[data-test-schedule-payment-form-submit-button]')
        .isDisabled();
    });

    test('it can switch to one-time payment after selecting monthly', async function (assert) {
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

    test(`it disables times before one hour from now (one-time payment)`, async function (assert) {
      await render(hbs`
        <SchedulePaymentFormActionCard />
      `);
      const now = new Date();
      const nextOneHour = addHours(now, 1);
      await click(`[data-test-payment-type="one-time"]`);
      await click(`[data-test-input-specific-payment-time]`);

      assert
        .dom(
          `[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="${format(
            nextOneHour,
            'h'
          )}"]`
        )
        .exists();

      //No disabled times if the nextOneHour is 00:00 or 12:00
      if (nextOneHour.getHours() !== 0 && nextOneHour.getHours() !== 12) {
        assert
          .dom(
            `[data-test-boxel-hour-menu] .boxel-menu__item--disabled [data-test-boxel-menu-item-text="${format(
              subHours(nextOneHour, 1),
              'h'
            )}"]`
          )
          .exists();
      }
    });

    test(`it disables dates before the payment day of month`, async function (assert) {
      await render(hbs`
        <SchedulePaymentFormActionCard />
      `);
      const paymentDayOfMonth = 1;
      const now = new Date();
      let minMonthlyUntil;
      if (paymentDayOfMonth < now.getDate()) {
        minMonthlyUntil = new Date(
          addMonths(now, 1).setDate(paymentDayOfMonth)
        );
      } else {
        minMonthlyUntil = now;
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
      assert
        .dom('[data-test-gas-token-select]')
        .containsText('Choose a Gas Token');
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

    // TODO: assert state for no network selected/connected
    // TODO: assert state for no safe present
  }
);
