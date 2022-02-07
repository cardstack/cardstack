import type { TestContext } from 'ember-test-helpers';
import type { Registry } from '@ember/service';

export function lookup<K extends keyof Registry>(
  testContext: TestContext,
  serviceName: K
): Registry[K] {
  return testContext.owner.lookup(`service:${serviceName}`);
}
