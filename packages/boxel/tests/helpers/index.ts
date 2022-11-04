import Resolver from 'ember-resolver';
import {
  // prettier-ignore
  setupApplicationTest as upstreamSetupApplicationTest,
  // prettier-ignore
  setupRenderingTest as upstreamSetupRenderingTest,
  // prettier-ignore
  setupTest as upstreamSetupTest,
  // prettier-ignore
} from 'ember-qunit';

interface SetupTestOptions {
  /**
   * The resolver to use when instantiating container-managed entities in the test.
   */
  resolver?: Resolver | undefined;
}

// This file exists to provide wrappers around ember-qunit's / ember-mocha's
// test setup functions. This way, you can easily extend the setup that is
// needed per test type.

function setupApplicationTest(
  hooks: NestedHooks,
  options?: SetupTestOptions
): void {
  upstreamSetupApplicationTest(hooks, options);

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
  options?: SetupTestOptions
): void {
  upstreamSetupRenderingTest(hooks, options);

  // Additional setup for rendering tests can be done here.
}

function setupTest(hooks: NestedHooks, options?: SetupTestOptions): void {
  upstreamSetupTest(hooks, options);

  // Additional setup for unit tests can be done here.
}

export { setupApplicationTest, setupRenderingTest, setupTest };

export function delay(delayAmountMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayAmountMs);
  });
}
