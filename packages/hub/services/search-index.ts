import { CompiledCard, RawCard } from '@cardstack/core/src/interfaces';
import { RawCardDeserializer } from '@cardstack/core/src/raw-card-deserializer';
import { NotFound } from '@cardstack/core/src/utils/errors';
import { inject } from '@cardstack/di';
import { PoolClient } from 'pg';
import { expressionToSql, param, upsert } from '../utils/expressions';
import { serializeRawCard } from '../utils/serialization';
import CardBuilder from './card-builder';

export class SearchIndex {
  private realmManager = inject('realm-manager', { as: 'realmManager' });
  private builder = inject('card-builder', { as: 'builder' });
  private database = inject('database-manager', { as: 'database' });

  async indexAllRealms(): Promise<void> {
    await Promise.all(
      this.realmManager.realms.map((realm) => {
        return this.runIndexing(realm.url, async (ops) => {
          await realm.reindex(ops, undefined);
        });
      })
    );
  }

  async getCard(cardURL: string): Promise<{ raw: RawCard; compiled: CompiledCard | undefined }> {
    let db = await this.database.getPool();
    let deserializer = new RawCardDeserializer();
    try {
      let {
        rows: [result],
      } = await db.query('SELECT data from cards where url = $1', [cardURL]);
      if (!result) {
        throw new NotFound(`Card ${cardURL} was not found`);
      }
      return deserializer.deserialize(result.data.data, result.data);
    } finally {
      db.release();
    }
  }

  // TODO: The realmURL arugment is neccessary until we refactor RawCard by
  // splitting up url into realmURL and ID
  async indexCard(raw: RawCard, realmURL: string): Promise<CompiledCard> {
    return await this.runIndexing(realmURL, async (ops) => {
      return await ops.saveAndReturn(raw);
    });
  }

  private async runIndexing<Out>(realmURL: string, fn: (ops: IndexerRun) => Promise<Out>): Promise<Out> {
    let db = await this.database.getPool();
    try {
      let run = new IndexerRun(db, this.builder, realmURL);
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
  private generation?: number;

  constructor(private db: PoolClient, private builder: CardBuilder, private realmURL: string) {}

  async finalize() {}

  async save(card: RawCard): Promise<void> {
    await this.saveAndReturn(card);
  }

  async saveAndReturn(card: RawCard): Promise<CompiledCard> {
    let compiledCard = await this.builder.compileCardFromRaw(card);
    let expression = upsert('cards', 'cards_pkey', {
      url: param(card.url),
      realm: param(this.realmURL),
      generation: param(this.generation || null),
      ancestors: param(ancestorsOf(compiledCard)),
      data: param(serializeRawCard(card, compiledCard)),
      searchData: param(card.data ? searchOptimizedData(card.data, compiledCard) : null),
    });
    await this.db.query(expressionToSql(expression));
    return compiledCard;
  }

  async delete(cardURL: string): Promise<void> {
    await this.db.query(`DELETE from cards where url=$1`, [cardURL]);
  }

  async beginReplaceAll(): Promise<void> {
    this.generation = Math.floor(Math.random() * 1000000000);
  }

  async finishReplaceAll(): Promise<void> {
    await this.db.query('DELETE FROM cards where realm = $1 AND generation != $2', [this.realmURL, this.generation]);
  }
}

function ancestorsOf(compiledCard: CompiledCard): string[] {
  if (!compiledCard.adoptsFrom) {
    return [];
  }
  return [compiledCard.adoptsFrom.url, ...ancestorsOf(compiledCard.adoptsFrom)];
}

function searchOptimizedData(data: Record<string, any>, compiled: CompiledCard): Record<string, any> {
  let result: Record<string, any> = {};

  for (let fieldName of Object.keys(compiled.fields)) {
    let currentCard: CompiledCard | undefined = compiled;
    do {
      let entry = result[currentCard.url];
      if (!entry) {
        entry = result[currentCard.url] = {};
      }
      entry[fieldName] = data[fieldName];
      currentCard = currentCard.adoptsFrom;
    } while (currentCard && currentCard.fields[fieldName]);
  }

  return result;
}

declare module '@cardstack/di' {
  interface KnownServices {
    searchIndex: SearchIndex;
  }
}
