import { CompiledCard, RawCard } from './../../src/interfaces';
import { Compiler } from '@cardstack/core';

export const FIXTURES: Map<string, CompiledCard> = new Map();

export async function addRawCard(card: RawCard): Promise<CompiledCard> {
  let compiler = new Compiler();
  let compiledCard = await compiler.compile(card);
  if (!compiledCard.url) {
    throw Error('The card needs a url in this context');
  }
  FIXTURES.set(compiledCard.url, compiledCard);

  return compiledCard;
}

export function compilerTestSetup(hooks: NestedHooks) {
  hooks.afterEach(function () {
    FIXTURES.clear();
  });
}
