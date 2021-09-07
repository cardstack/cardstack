declare module 'ember-cli-mirage/test-support' {
  export function setupMirage(hooks: any): void;
}

import { Server } from 'ember-cli-mirage';
import { TestContext } from 'ember-test-helpers';

export function setupMirage(hooks: NestedHooks): void;

// Allows you to use `this.server` in Mirage tests.
export interface MirageTestContext extends TestContext {
  server: Server;
}
