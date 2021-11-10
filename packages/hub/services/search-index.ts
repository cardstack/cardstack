import { CompiledCard, RawCard } from '@cardstack/core/src/interfaces';
import { inject } from '@cardstack/di';
import { PoolClient } from 'pg';
import { serializeRawCard } from '../utils/serialization';
import CardBuilder from './card-builder';

export class SearchIndex {
  private realmManager = inject('realm-manager', { as: 'realmManager' });
  private builder = inject('card-builder', { as: 'builder' });
  private database = inject('database-manager', { as: 'database' });

  async indexAllRealms(): Promise<void> {
    await this.runIndexing(async (ops) => {
      await Promise.all(this.realmManager.realms.map((realm) => realm.reindex(ops, undefined)));
    });
  }

  async indexCard(raw: RawCard): Promise<CompiledCard> {
    return await this.runIndexing(async (ops) => {
      return await ops.saveAndReturn(raw);
    });
  }

  private async runIndexing<Out>(fn: (ops: IndexerRun) => Promise<Out>): Promise<Out> {
    let db = await this.database.getPool();
    try {
      let run = new IndexerRun(db, this.builder);
      let result = await fn(run);
      await run.finalize();
      return result;
    } finally {
      db.release();
    }
  }

  notify(_cardURL: string, _action: 'save' | 'delete'): void {
    throw new Error('not implemented');
  }

  async reset() {
    let db = await this.database.getPool();
    try {
      await db.query('DELETE from cards');
    } finally {
      db.release();
    }
  }
}

// this is the methods that we allow Realms to call
export interface IndexerHandle {
  save(card: RawCard): Promise<void>;
  delete(cardURL: string): Promise<void>;
  beginReplaceAll(): Promise<void>;
  finishReplaceAll(): Promise<void>;
}

class IndexerRun implements IndexerHandle {
  constructor(private db: PoolClient, private builder: CardBuilder) {}

  async finalize() {}

  async save(card: RawCard): Promise<void> {
    await this.saveAndReturn(card);
  }

  async saveAndReturn(card: RawCard): Promise<CompiledCard> {
    let compiledCard = await this.builder.compileCardFromRaw(card);
    await this.db.query(`INSERT into cards (url, ancestors, data) VALUES ($1, $2, $3)`, [
      card.url,
      ancestorsOf(compiledCard),
      serializeRawCard(card, compiledCard),
    ]);
    return compiledCard;
  }

  async delete(cardURL: string): Promise<void> {
    await this.db.query(`DELETE from cards where url=$1`, [cardURL]);
  }

  async beginReplaceAll(): Promise<void> {}

  async finishReplaceAll(): Promise<void> {}
}

declare module '@cardstack/di' {
  interface KnownServices {
    searchIndex: SearchIndex;
  }
}
function ancestorsOf(compiledCard: CompiledCard): string[] {
  if (!compiledCard.adoptsFrom) {
    return [];
  }
  return [compiledCard.adoptsFrom.url, ...ancestorsOf(compiledCard.adoptsFrom)];
}
