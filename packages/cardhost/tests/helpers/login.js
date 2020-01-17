import { click, waitFor, visit } from '@ember/test-helpers';
import { getContext } from '@ember/test-helpers';
import { run } from '@ember/runloop';

function setMockUser(userId) {
  let { owner } = getContext();
  let mockLogin = owner.lookup('service:mock-login');
  run(() => mockLogin.set('mockUserId', userId));
}

export async function login() {
  await visit('/cards/why-doors');
  setMockUser('user1');
  await waitFor('[data-test-toggle-left-edge]');
  await click('[data-test-toggle-left-edge]');
  await waitFor('[data-test-login-button]');
  await click('[data-test-login-button]');
  await waitFor('[data-test-logout-button]');
  await click('[data-test-toggle-left-edge]');
}

export function setupMockUser(factory) {
  factory.addResource('data-sources', 'mock-auth').withAttributes({
    sourceType: '@cardstack/mock-auth',
    params: {
      users: {
        user1: {
          name: 'Carl Stack',
          email: 'carlstack@cardstack.com',
          verified: true,
        },
      },
    },
  });
}
