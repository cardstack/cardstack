import { click, fillIn } from '@ember/test-helpers';
import { keyDown } from 'ember-keyboard/test-support/test-helpers';
import { selectChoose } from 'ember-power-select/test-support';

export const EXAMPLE_PAYEE = '0xb794f5ea0ba39494ce839613fffba74279579268';

export async function chooseTomorrow(selector: string): Promise<void> {
  await click(selector);
  await keyDown('ArrowRight');
  await keyDown('Enter');
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

export async function fillInSchedulePaymentFormWithValidInfo() {
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

  await click('[data-test-max-gas-toggle] [data-toggle-group-option="normal"]');
}
