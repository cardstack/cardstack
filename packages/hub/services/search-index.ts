import { makeGloballyAddressable } from '@cardstack/core/src/compiler';
import { CompiledCard, ModuleRef, RawCard, Saved, Unsaved } from '@cardstack/core/src/interfaces';
import { RawCardDeserializer } from '@cardstack/core/src/raw-card-deserializer';
import { cardURL } from '@cardstack/core/src/utils';
import { JS_TYPE } from '@cardstack/core/src/utils/content';
import { CardstackError, NotFound, serializableError } from '@cardstack/core/src/utils/errors';
import { inject } from '@cardstack/di';
import { PoolClient } from 'pg';
import { BROWSER, NODE } from '../interfaces';
import { expressionToSql, param, upsert } from '../utils/expressions';
import { serializeRawCard } from '../utils/serialization';
import CardBuilder from './card-builder';
import { transformSync } from '@babel/core';
// @ts-ignore
import TransformModulesCommonJS from '@babel/plugin-transform-modules-commonjs';
// @ts-ignore
import ClassPropertiesPlugin from '@babel/plugin-proposal-class-properties';

export class SearchIndex {
  private realmManager = inject('realm-manager', { as: 'realmManager' });
  private builder = inject('card-builder', { as: 'builder' });
  private database = inject('database-manager', { as: 'database' });
  private fileCache = inject('card-cache', { as: 'fileCache' });

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
      } = await db.query('SELECT data, "compileErrors" from cards where url = $1', [cardURL]);
      if (!result) {
        throw new NotFound(`Card ${cardURL} was not found`);
      }
      if (result.compileErrors) {
        throw CardstackError.fromSerializableError(result.compileErrors);
      }
      return deserializer.deserialize(result.data.data, result.data);
    } finally {
      db.release();
    }
  }

  async indexCard(raw: RawCard, compiled: CompiledCard<Saved | Unsaved, ModuleRef>): Promise<CompiledCard> {
    return await this.runIndexing(raw.realm, async (ops) => {
      return await ops.internalSave(raw, compiled);
    });
  }

  private async runIndexing<Out>(realmURL: string, fn: (ops: IndexerRun) => Promise<Out>): Promise<Out> {
    let db = await this.database.getPool();
    try {
      let run = new IndexerRun(db, this.builder, realmURL, this.fileCache);
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

  constructor(
    private db: PoolClient,
    private builder: CardBuilder,
    private realmURL: string,
    private fileCache: SearchIndex['fileCache']
  ) {}

  async finalize() {}

  // available to each realm's indexer
  async save(card: RawCard): Promise<void> {
    try {
      let compiledCard = await this.builder.compileCardFromRaw(card);
      await this.internalSave(card, compiledCard);
    } catch (err: any) {
      await this.saveErrorState(card, err);
    }
  }

  // used directly by the hub when mutating cards
  async internalSave(rawCard: RawCard, compiledCard: CompiledCard<Saved | Unsaved, ModuleRef>): Promise<CompiledCard> {
    let definedCard = makeGloballyAddressable(cardURL(rawCard), compiledCard, (local, type, src) =>
      this.define(cardURL(rawCard), local, type, src)
    );
    return await this.writeToIndex(rawCard, definedCard);
  }

  private define(cardURL: string, localPath: string, type: string, source: string): string {
    switch (type) {
      case JS_TYPE:
        this.fileCache.setModule(BROWSER, cardURL, localPath, source);
        return this.fileCache.setModule(NODE, cardURL, localPath, this.transformToCommonJS(localPath, source));
      default:
        return this.fileCache.writeAsset(cardURL, localPath, source);
    }
  }

  private transformToCommonJS(moduleURL: string, source: string): string {
    let out = transformSync(source, {
      configFile: false,
      babelrc: false,
      filenameRelative: moduleURL,
      plugins: [ClassPropertiesPlugin, TransformModulesCommonJS],
    });
    return out!.code!;
  }

  private async writeToIndex(card: RawCard, compiledCard: CompiledCard): Promise<CompiledCard> {
    let expression = upsert('cards', 'cards_pkey', {
      url: param(cardURL(card)),
      realm: param(this.realmURL),
      generation: param(this.generation || null),
      ancestors: param(ancestorsOf(compiledCard)),
      data: param(serializeRawCard(card, compiledCard)),
      searchData: param(card.data ? searchOptimizedData(card.data, compiledCard) : null),
      compileErrors: param(null),
    });
    await this.db.query(expressionToSql(expression));
    return compiledCard;
  }

  private async saveErrorState(card: RawCard, err: any): Promise<void> {
    let expression = upsert('cards', 'cards_pkey', {
      url: param(cardURL(card)),
      realm: param(this.realmURL),
      generation: param(this.generation || null),
      ancestors: param(null),
      data: param(null),
      searchData: param(null),
      compileErrors: param(serializableError(err)),
    });
    await this.db.query(expressionToSql(expression));
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
