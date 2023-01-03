import { click, find, fillIn } from '@ember/test-helpers';
import format from 'date-fns/format';
import { keyDown } from 'ember-keyboard/test-support/test-helpers';
import { selectChoose } from 'ember-power-select/test-support';

export const EXAMPLE_PAYEE = '0xb794f5ea0ba39494ce839613fffba74279579268';
export const EXAMPLE_AMOUNT = '15.0';

export async function chooseTomorrow(selector: string): Promise<void> {
  await click(selector);
  await keyDown('ArrowRight');
  await keyDown('Enter');
  await keyDown('Escape');
}

export async function chooseFutureDate(selector: string, date: Date) {
  await click(selector);
  let found = false;
  const targetSelector = `[data-date="${format(date, 'yyyy-MM-dd')}"]`;
  while (!found) {
    if (find(targetSelector)) {
      found = true;
    } else {
      await click('.ember-power-calendar-nav-control--next');
    }
  }
  await click(targetSelector);
  await keyDown('Escape');
}

export async function chooseTime(
  selector: string,
  hours: number,
  minutes: number,
  meridian: 'am' | 'pm'
) {
  await click(selector);
  for (const char of hours.toString()) {
    await keyDown(char);
  }
  await keyDown(':');
  const minutesString = (minutes < 10 ? '0' : '') + minutes.toString();
  for (const char of minutesString) {
    await keyDown(char);
  }
  await keyDown(meridian === 'am' ? 'A' : 'P');
  await keyDown('Enter');
}

async function chooseDayOfMonth(selector: string, dayNumber: number) {
  await click(selector);
  await click(`[data-option-index="${dayNumber - 1}"]`);
}

interface FormFillOptions {
  type: 'one-time' | 'monthly';
}

export async function fillInSchedulePaymentFormWithValidInfo(
  options: FormFillOptions = { type: 'one-time' }
) {
  if (options.type === 'one-time') {
    await click('[data-test-payment-type="one-time"]');
    await chooseTomorrow('[data-test-boxel-input-date-trigger]');
    await chooseTime('[data-test-boxel-input-time-trigger]', 9, 0, 'am');
  } else if (options.type === 'monthly') {
    await click('[data-test-payment-type="monthly"]');
    await chooseDayOfMonth('[data-test-input-recurring-day-of-month]', 15);
    const nextYear = new Date(
      new Date().setFullYear(new Date().getFullYear() + 1)
    );
    await chooseFutureDate('[data-test-input-recurring-until]', nextYear);
  }

  await fillIn('[data-test-payee-address-input]', EXAMPLE_PAYEE);
  await fillIn('[data-test-amount-input] input', EXAMPLE_AMOUNT);

  // Choose USDC for the transaction token
  await selectChoose(
    '[data-test-amount-input] [data-test-boxel-input-group-select-accessory-trigger]',
    'USDC'
  );

  // Choose USDC for the gas token
  await selectChoose('[data-test-gas-token-select]', 'USDC');

  await click('[data-test-max-gas-toggle] [data-toggle-group-option="normal"]');
}
