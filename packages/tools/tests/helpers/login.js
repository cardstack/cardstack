import { waitFor, click } from '@ember/test-helpers';

export async function login() {
  await click('*[data-test-cardstack=login-button]');
  return waitFor('.cardstack-tools-launcher');
}
