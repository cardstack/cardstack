import { CompiledCard, RawCard } from './../../src/interfaces';
import { Compiler } from '@cardstack/core';

export const FIXTURES: Map<string, CompiledCard> = new Map();

export async function addRawCard(card: RawCard): Promise<void> {
  let compiler = new Compiler();
  let compiledCard = await compiler.compile(card);
  if (!compiledCard.url) {
    throw Error('The card needs a url in this context');
  }
  FIXTURES.set(compiledCard.url, compiledCard);
}

export function compilerTestSetup(hooks: NestedHooks) {
  hooks.beforeEach(function () {
    // FIXTURES.clear(); Maybe we'll need this?
  });

  hooks.afterEach(function () {
    FIXTURES.clear();
  });
}
