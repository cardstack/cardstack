import { Builder as BuilderInterface, RawCard, CompiledCard, Saved, Unsaved } from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';

import { inject } from '@cardstack/di';
import logger from '@cardstack/logger';
import { NotFound } from '@cardstack/core/src/utils/errors';
const log = logger('hub/card-builder');

export default class CardBuilder implements BuilderInterface {
  realmManager = inject('realm-manager', { as: 'realmManager' });
  cache = inject('card-cache', { as: 'cache' });
  cards = inject('card-service', { as: 'cards' });
  index = inject('searchIndex', { as: 'index' });

  async getRawCard(url: string): Promise<RawCard> {
    log.trace('getRawCard: %s', url);
    return await this.realmManager.read(this.realmManager.parseCardURL(url.replace(/\/$/, '')));
  }

  async getCompiledCard(url: string): Promise<CompiledCard> {
    log.trace('getCompiledCard: %s', url);
    let { compiled } = await this.index.getCard(url);
    if (!compiled) {
      throw new NotFound(`CardBuilder could not find ${url}`);
    }
    return compiled;
  }

  compileCardFromRaw<Identity extends Saved | Unsaved>(cardSource: RawCard<Identity>): Compiler<Identity> {
    return new Compiler({ builder: this, cardSource });
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-builder': CardBuilder;
  }
}
