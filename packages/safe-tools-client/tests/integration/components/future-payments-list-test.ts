/* eslint-disable @typescript-eslint/no-empty-function */
import { ChainAddress } from '@cardstack/cardpay-sdk';
import SchedulePaymentSDKService from '@cardstack/safe-tools-client/services/scheduled-payment-sdk';
import ScheduledPaymentsService from '@cardstack/safe-tools-client/services/scheduled-payments';
import TokenToUsdService from '@cardstack/safe-tools-client/services/token-to-usd';
import TokenQuantity from '@cardstack/safe-tools-client/utils/token-quantity';
import Service from '@ember/service';
import { render, click, TestContext } from '@ember/test-helpers';
import percySnapshot from '@percy/ember';
import {
  addDays,
  addHours,
  addMonths,
  startOfDay,
  endOfDay,
  endOfMonth,
  addMinutes,
} from 'date-fns';
import { task } from 'ember-concurrency-decorators';
import {
  setupFakeDateService,
  FakeDateService,
} from 'ember-date-service/test-support';
import { BigNumber, FixedNumber } from 'ethers';
import hbs from 'htmlbars-inline-precompile';
import { module, test } from 'qunit';

import { setupRenderingTest } from '../../helpers';

class WalletServiceStub extends Service {
  isConnected = true;
}
class HubAuthenticationServiceStub extends Service {
  isAuthenticated = true;
}

class SafesServiceStub extends Service {
  currentSafe = {
    address: '0xc0ffee254729296a45a3885639AC7E10F9d54979',
  };
  reloadTokenBalances() {}
}

const NOW = new Date(2023, 0, 1);

let returnEmptyScheduledPayments = false;
let returnScheduledPaymentsUntilTomorrow = false;
let returnOnlyLaterScheduledPayments = false;
let dateService: FakeDateService;

class TokenToUsdServiceStub extends TokenToUsdService {
  // eslint-disable-next-line require-yield
  @task({ maxConcurrency: 1, enqueue: true }) *updateUsdcRate(
    tokenAddress: ChainAddress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): any {
    this.usdcToTokenRates.set(tokenAddress, {
      tokenInAddress: '0x0',
      tokenOutAddress: '0x0',
      tokenInDecimals: 6,
      tokenOutDecimals:
        tokenAddress === '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' ? 6 : 18,
      rate:
        tokenAddress === '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
          ? FixedNumber.from('1')
          : FixedNumber.from('0.001'),
    });
  }
}

class ScheduledPaymentsStub extends ScheduledPaymentsService {
  // @ts-expect-error - we're overriding this method for testing purposes
  fetchScheduledPayments = (
    chainId: number,
    senderSafeAddress: string,
    minPayAt?: Date
  ) => {
    if (returnEmptyScheduledPayments || !minPayAt) {
      return Promise.resolve([]);
    }

    const startOfToday = startOfDay(minPayAt);
    const endOfToday = endOfDay(minPayAt);
    const startOfTomorrow = startOfDay(addDays(minPayAt, 1));
    const endOfTomorrow = endOfDay(addDays(minPayAt, 1));
    const endOfThisMonth = endOfMonth(minPayAt);

    const USDC_TOKEN = {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      logoURI:
        'https://assets-cdn.trustwallet.com/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
    };

    const DAI_TOKEN = {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      name: 'Dai',
      symbol: 'DAI',
      decimals: 18,
      logoURI:
        'https://assets-cdn.trustwallet.com/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png',
    };

    // 1 SP is yesterday but not yet run (5-minute window where this could happen)
    // 3 SPs are today
    // 2 Sps are tomorrow
    // 1 Sp is this month
    // 1 Sp is later
    const scheduledPayments = [
      {
        paymentTokenQuantity: new TokenQuantity(
          USDC_TOKEN,
          BigNumber.from('15000000')
        ),
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        senderSafeAddress,
        payAt: addMinutes(startOfToday, -2),
      },
      {
        paymentTokenQuantity: new TokenQuantity(
          USDC_TOKEN,
          BigNumber.from('10000000')
        ),
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        senderSafeAddress,
        payAt: startOfToday,
      },
      {
        paymentTokenQuantity: new TokenQuantity(
          USDC_TOKEN,
          BigNumber.from('10000000')
        ),
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        senderSafeAddress,
        payAt: addHours(startOfToday, 2),
      },
      {
        paymentTokenQuantity: new TokenQuantity(
          DAI_TOKEN,
          BigNumber.from('11000000')
        ),
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        senderSafeAddress,
        payAt: endOfToday,
      },
      {
        paymentTokenQuantity: new TokenQuantity(
          DAI_TOKEN,
          BigNumber.from('11000000')
        ),
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        senderSafeAddress,
        payAt: startOfTomorrow,
      },
      {
        paymentTokenQuantity: new TokenQuantity(
          USDC_TOKEN,
          BigNumber.from('11000000')
        ),
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        senderSafeAddress,
        payAt: endOfTomorrow,
      },
      {
        paymentTokenQuantity: new TokenQuantity(
          USDC_TOKEN,
          BigNumber.from('11000000')
        ),
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        senderSafeAddress,
        payAt: endOfThisMonth,
      },
      {
        paymentTokenQuantity: new TokenQuantity(
          USDC_TOKEN,
          BigNumber.from('11000000')
        ),
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        senderSafeAddress,
        payAt: addDays(endOfThisMonth, 1),
        recurringDayOfMonth: addDays(endOfThisMonth, 1).getTime(),
        recurringUntil: addMonths(addDays(endOfThisMonth, 1), 5),
      },
      {
        id: 'creation_transaction_pending',
        paymentTokenQuantity: new TokenQuantity(
          USDC_TOKEN,
          BigNumber.from('11000000')
        ),
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        senderSafeAddress,
        payAt: addDays(endOfThisMonth, 1),
        recurringDayOfMonth: addDays(endOfThisMonth, 1).getTime(),
        recurringUntil: addMonths(addDays(endOfThisMonth, 1), 5),
        creationTransactionHash: '0x123',
        creationBlockNumber: null,
        creationTransactionError: null,
      },
      {
        id: 'creation_transaction_failed',
        paymentTokenQuantity: new TokenQuantity(
          USDC_TOKEN,
          BigNumber.from('11000000')
        ),
        feeFixedUSD: '0',
        feePercentage: '0',
        gasTokenAddress: '0x123',
        chainId,
        payeeAddress: '0xeBCC5516d44FFf5E9aBa2AcaeB65BbB49bC3EBe1',
        senderSafeAddress,
        payAt: addMonths(endOfThisMonth, 1),
        recurringDayOfMonth: addDays(endOfThisMonth, 1).getTime(),
        recurringUntil: addMonths(addDays(endOfThisMonth, 1), 5),
        creationTransactionHash: '0x123',
        creationBlockNumber: null,
        creationTransactionError: 'Insufficient funds',
      },
    ];

    if (returnScheduledPaymentsUntilTomorrow) {
      return Promise.resolve(
        scheduledPayments.filter((sp) => sp.payAt <= endOfTomorrow)
      );
    }

    if (returnOnlyLaterScheduledPayments) {
      return Promise.resolve(
        scheduledPayments.filter((sp) => sp.payAt >= addDays(endOfThisMonth, 1))
      );
    }

    return Promise.resolve(scheduledPayments);
  };
}

module('Integration | Component | future-payments-list', function (hooks) {
  setupRenderingTest(hooks);
  setupFakeDateService(hooks);

  hooks.beforeEach(async function (this: TestContext) {
    this.owner.register('service:wallet', WalletServiceStub);
    this.owner.register('service:scheduled-payments', ScheduledPaymentsStub);
    this.owner.register(
      'service:hub-authentication',
      HubAuthenticationServiceStub
    );
    this.owner.register('service:safes', SafesServiceStub);

    dateService = this.owner.lookup('service:date') as FakeDateService;
    await dateService.setNow(NOW.getTime());
    this.owner.register('service:token-to-usd', TokenToUsdServiceStub);
  });

  hooks.afterEach(function () {
    returnEmptyScheduledPayments = false;
    returnScheduledPaymentsUntilTomorrow = false;
    returnOnlyLaterScheduledPayments = false;
    dateService.reset();
  });

  test('It renders no payments display if no future payments', async function (assert) {
    assert.expect(2);
    returnEmptyScheduledPayments = true;
    this.set('onDepositClick', () => {});
    await render(hbs`
      <FuturePaymentsList @onDepositClick={{this.onDepositClick}} />
    `);

    await percySnapshot(assert);
    assert.dom('[data-test-no-future-payments-list]').isVisible();
    assert.dom('[data-test-future-payments-list]').isNotVisible();
  });

  test('It renders future payments list', async function (assert) {
    assert.expect(10);
    this.set('onDepositClick', () => {});
    await render(hbs`
      <FuturePaymentsList @onDepositClick={{this.onDepositClick}} />
    `);

    await percySnapshot(assert);
    assert.dom('[data-test-no-future-payments-list]').isNotVisible();
    assert.dom('[data-test-future-payments-list]').isVisible();
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='today'] [data-test-scheduled-payment-card]`
      ).length,
      4
    );
    assert.true(
      document
        .querySelectorAll(
          `[data-test-time-bracket='today'] [data-test-scheduled-payment-card]`
        )[0]
        .querySelector('.scheduled-payment-card__pay-at')
        ?.textContent?.includes('One-time')
    );
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='tomorrow'] [data-test-scheduled-payment-card]`
      ).length,
      2
    );
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='this month'] [data-test-scheduled-payment-card]`
      ).length,
      1
    );
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='later'] [data-test-scheduled-payment-card]`
      ).length,
      3
    );
    assert.true(
      document
        .querySelectorAll(
          `[data-test-time-bracket='later'] [data-test-scheduled-payment-card]`
        )[0]
        .querySelector('.scheduled-payment-card__pay-at')
        ?.textContent?.includes('Recurring')
    );

    assert
      .dom(
        `[data-test-scheduled-payment-card-id=creation_transaction_pending] .scheduled_payment_card__tooltip`
      )
      .includesText(
        'The transaction to register this payment on blockchain is still pending'
      );

    assert
      .dom(
        `[data-test-scheduled-payment-card-id=creation_transaction_failed] .scheduled_payment_card__tooltip`
      )
      .includesText(
        'The transaction to register this payment on blockchain has failed'
      );
  });

  test('can cancel a payment', async function (assert) {
    const scheduledPaymentSdkService = this.owner.lookup(
      'service:scheduled-payment-sdk'
    ) as SchedulePaymentSDKService;

    scheduledPaymentSdkService.cancelScheduledPayment = (): Promise<void> => {
      return Promise.resolve();
    };

    this.set('onDepositClick', () => {});
    await render(hbs`
      <FuturePaymentsList @onDepositClick={{this.onDepositClick}} />
    `);

    await click('[data-test-scheduled-payment-card-options-button]');
    await click('[data-test-boxel-menu-item-text="Cancel Payment"]');
    await click('[data-test-cancel-payment-button]');

    assert
      .dom('[data-test-cancel-scheduled-payment-modal]')
      .includesText(
        "Your scheduled payment was canceled and removed successfully, and it won't be attempted in the future."
      );
    assert.dom('[data-test-cancel-payment-button]').doesNotExist();

    // On cancel, the handler calls refreshScheduledPayments (to remove the newly canceled payment) which reads stubbed scheduled payment values from this test.
    // To test if the list reloaded after canceling a payment we simply change the stubbed values to return no payments and assert that the list is empty, which confirms that the list reloaded.
    const scheduledPaymentsService = this.owner.lookup(
      'service:scheduled-payments'
    ) as ScheduledPaymentsService;

    scheduledPaymentsService.fetchScheduledPayments = (): Promise<[]> => {
      return Promise.resolve([]);
    };

    await click('[data-test-close-cancel-payment-modal]');
    assert.dom('[data-test-cancel-scheduled-payment-modal]').doesNotExist();
    assert.dom('[data-test-scheduled-payment-card]').doesNotExist(); // Because we stubbed fetchScheduledPayments to return no payments
  });

  test('it shows an error when canceling fails', async function (assert) {
    const scheduledPaymentSdkService = this.owner.lookup(
      'service:scheduled-payment-sdk'
    ) as SchedulePaymentSDKService;

    scheduledPaymentSdkService.cancelScheduledPayment = (): Promise<void> => {
      return Promise.reject('error while canceling payment');
    };

    this.set('onDepositClick', () => {});
    await render(hbs`
      <FuturePaymentsList @onDepositClick={{this.onDepositClick}} />
    `);

    await click('[data-test-scheduled-payment-card-options-button]');
    await click('[data-test-boxel-menu-item-text="Cancel Payment"]');
    await click('[data-test-cancel-payment-button]');
    assert
      .dom('[data-test-cancel-scheduled-payment-modal]')
      .includesText(
        'There was an error canceling your scheduled payment. Please try again, or contact support if the problem persists.'
      );
    assert.dom('[data-test-cancel-payment-button]').exists();
  });

  test('It renders future payments list, with no this month and later time windows', async function (assert) {
    assert.expect(6);
    returnScheduledPaymentsUntilTomorrow = true;
    this.set('onDepositClick', () => {});
    await render(hbs`
      <FuturePaymentsList @onDepositClick={{this.onDepositClick}} />
    `);

    await percySnapshot(assert);
    assert.dom('[data-test-no-future-payments-list]').isNotVisible();
    assert.dom('[data-test-future-payments-list]').isVisible();
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='today'] [data-test-scheduled-payment-card]`
      ).length,
      4
    );
    assert.strictEqual(
      document.querySelectorAll(
        `[data-test-time-bracket='tomorrow'] [data-test-scheduled-payment-card]`
      ).length,
      2
    );
    assert.dom(`[data-test-time-bracket='this month']`).isNotVisible();
    assert.dom(`[data-test-time-bracket='later']`).isNotVisible();
  });

  test('It renders future payments list, with no earlier time windows than later', async function (assert) {
    assert.expect(6);
    returnOnlyLaterScheduledPayments = true;
    this.set('onDepositClick', () => {});
    await render(hbs`
      <FuturePaymentsList @onDepositClick={{this.onDepositClick}} />
    `);

    await percySnapshot(assert);
    assert.dom('[data-test-no-future-payments-list]').isNotVisible();
    assert.dom('[data-test-future-payments-list]').isVisible();
    assert.dom(`[data-test-time-bracket='today']`).isNotVisible();
    assert.dom(`[data-test-time-bracket='tomorrow']`).isNotVisible();
    assert.dom(`[data-test-time-bracket='this month']`).isNotVisible();
    assert.dom(`[data-test-time-bracket='']`).isVisible(); // Blank title if there is no earlier time windows than "later"
  });
});
