import { Compiler, makeGloballyAddressable } from '@cardstack/core/src/compiler';
import { CompiledCard, ModuleRef, RawCard, Unsaved } from '@cardstack/core/src/interfaces';
import { RawCardDeserializer, RawCardSerializer } from '@cardstack/core/src/serializers';
import { cardURL } from '@cardstack/core/src/utils';
import { JS_TYPE } from '@cardstack/core/src/utils/content';
import { CardstackError, NotFound, serializableError } from '@cardstack/core/src/utils/errors';
import { inject } from '@cardstack/di';
import { PoolClient } from 'pg';
import Cursor from 'pg-cursor';
import { BROWSER, NODE } from '../interfaces';
import { Expression, expressionToSql, param, PgPrimitive, upsert } from '../utils/expressions';
import CardBuilder from './card-builder';
import { transformSync } from '@babel/core';
import logger from '@cardstack/logger';

// @ts-ignore
import TransformModulesCommonJS from '@babel/plugin-transform-modules-commonjs';
// @ts-ignore
import ClassPropertiesPlugin from '@babel/plugin-proposal-class-properties';

const log = logger('hub/search-index');

export class SearchIndex {
  private realmManager = inject('realm-manager', { as: 'realmManager' });
  private builder = inject('card-builder', { as: 'builder' });
  private database = inject('database-manager', { as: 'database' });
  private fileCache = inject('file-cache', { as: 'fileCache' });

  async indexAllRealms(): Promise<void> {
    await Promise.all(
      this.realmManager.realms.map((realm) => {
        return this.runIndexing(realm.url, async (ops) => {
          let meta = await ops.loadMeta();
          let newMeta = await realm.reindex(ops, meta);
          ops.setMeta(newMeta);
        });
      })
    );
  }

  async getCard(cardURL: string): Promise<{ raw: RawCard; compiled: CompiledCard | undefined }> {
    log.trace('getCard', cardURL);
    let db = await this.database.getPool();
    let deserializer = new RawCardDeserializer();
    try {
      let {
        rows: [result],
      } = await db.query('SELECT compiled, "compileErrors", deps from cards where url = $1', [cardURL]);
      if (!result) {
        throw new NotFound(`Card ${cardURL} was not found`);
      }
      if (result.compileErrors) {
        let err = CardstackError.fromSerializableError(result.compileErrors);
        if (result.deps) {
          err.deps = result.deps;
        }
        throw err;
      }
      return deserializer.deserialize(result.compiled.data, result.compiled);
    } finally {
      db.release();
    }
  }

  async deleteCard(raw: RawCard) {
    let url = cardURL(raw);
    log.trace('deleteCard', url);
    await this.runIndexing(raw.realm, async (ops) => {
      return await ops.delete(url);
    });
  }

  async indexCard(
    raw: RawCard,
    compiled: CompiledCard<Unsaved, ModuleRef>,
    compiler: Compiler<Unsaved>
  ): Promise<CompiledCard> {
    log.trace('indexCard', cardURL(raw));
    return await this.runIndexing(raw.realm, async (ops) => {
      return await ops.internalSave(raw, compiled, compiler);
    });
  }

  private async runIndexing<Out>(realmURL: string, fn: (ops: IndexerRun) => Promise<Out>): Promise<Out> {
    let db = await this.database.getPool();
    try {
      log.trace(`starting to index realm`, realmURL);
      let run = new IndexerRun(db, this.builder, realmURL, this.fileCache);
      let result = await fn(run);
      await run.finalize();
      log.trace(`finished indexing realm`, realmURL);
      return result;
    } finally {
      db.release();
    }
  }

  notify(_cardURL: string, _action: 'save' | 'delete'): void {
    throw new Error('not implemented');
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
  private touchCounter = 0;
  private touched = new Map<string, number>();
  private newMeta: PgPrimitive = null;

  constructor(
    private db: PoolClient,
    private builder: CardBuilder,
    private realmURL: string,
    private fileCache: SearchIndex['fileCache']
  ) {}

  async loadMeta(): Promise<PgPrimitive> {
    let metaResult = await this.db.query(
      expressionToSql(['select meta from realm_metas where realm=', param(this.realmURL)])
    );
    return metaResult.rows[0]?.meta;
  }

  setMeta(meta: PgPrimitive) {
    this.newMeta = meta;
  }

  private async storeMeta(): Promise<void> {
    await this.db.query(
      expressionToSql(
        upsert('realm_metas', 'realm_metas_pkey', { realm: param(this.realmURL), meta: param(this.newMeta) })
      )
    );
  }

  async finalize() {
    await this.possiblyInvalidatedCards(async (cardURL: string, deps: string[], raw: RawCard) => {
      if (!this.isValid(cardURL, deps)) {
        log.trace(`reindexing %s because %s`, cardURL, deps);
        await this.save(raw);
      }
    });
    await this.storeMeta();
  }

  // This doesn't need to recurse because we intend for the `deps` column to
  // contain all deep references, not  just immediate references
  private async possiblyInvalidatedCards(fn: (cardURL: string, deps: string[], raw: RawCard) => Promise<void>) {
    const queryBatchSize = 100;
    let queue = [...this.touched.keys()];
    for (let i = 0; i < queue.length; i += queryBatchSize) {
      let queryRefs = queue.slice(i, i + queryBatchSize);
      await this.iterateThroughRows(
        ['select url, deps, raw from cards where', param(queryRefs), '&&', 'deps'],
        async (row) => {
          let deserializer = new RawCardDeserializer();
          let { raw } = deserializer.deserialize(row.raw.data, row.raw);
          await fn(row.url, row.deps, raw);
        }
      );
    }
  }

  private isValid(cardURL: string, deps: string[]): boolean {
    let maybeTouchedAt = this.touched.get(cardURL);
    if (maybeTouchedAt == null) {
      // our card hasn't been updated at all, so it definitely needs to be redone
      return false;
    }
    let cardTouchedAt = maybeTouchedAt;
    return deps.every((dep) => {
      let depTouchedAt = this.touched.get(dep);
      depTouchedAt == null || depTouchedAt < cardTouchedAt;
    });
  }

  private async iterateThroughRows(expression: Expression, fn: (row: Record<string, any>) => Promise<void>) {
    const rowBatchSize = 100;
    let { text, values } = expressionToSql(expression);
    let cursor: Cursor = this.db.query(new Cursor(text, values) as any);
    let rows;
    do {
      rows = await readCursor(cursor, rowBatchSize);
      for (let row of rows) {
        await fn(row);
      }
    } while (rows.length > 0);
  }

  // available to each realm's indexer
  async save(card: RawCard): Promise<void> {
    let compiler = await this.builder.compileCardFromRaw(card);
    try {
      let compiledCard = await compiler.compile();
      await this.internalSave(card, compiledCard, compiler);
    } catch (err: any) {
      await this.saveErrorState(card, err, compiler);
    }
  }

  // used directly by the hub when mutating cards
  async internalSave(
    rawCard: RawCard,
    compiledCard: CompiledCard<Unsaved, ModuleRef>,
    compiler: Compiler<Unsaved>
  ): Promise<CompiledCard> {
    let definedCard = makeGloballyAddressable(cardURL(rawCard), compiledCard, (local, type, src) =>
      this.define(cardURL(rawCard), local, type, src)
    );
    return await this.writeToIndex(rawCard, definedCard, compiler);
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

  private async writeToIndex(
    card: RawCard,
    compiledCard: CompiledCard,
    compiler: Compiler<Unsaved>
  ): Promise<CompiledCard> {
    let url = cardURL(card);
    let expression = upsert('cards', 'cards_pkey', {
      url: param(url),
      realm: param(this.realmURL),
      generation: param(this.generation || null),
      ancestors: param(ancestorsOf(compiledCard)),
      data: param(card.data ?? null),
      raw: param(new RawCardSerializer().serialize(card)),
      compiled: param(new RawCardSerializer().serialize(card, compiledCard)),
      searchData: param(card.data ? searchOptimizedData(card.data, compiledCard) : null),
      compileErrors: param(null),
      deps: param([...compiler.dependencies]),
    });
    await this.db.query(expressionToSql(expression));
    this.touched.set(url, this.touchCounter++);
    return compiledCard;
  }

  private async saveErrorState(card: RawCard, err: any, compiler: Compiler): Promise<void> {
    let url = cardURL(card);
    let expression = upsert('cards', 'cards_pkey', {
      url: param(url),
      realm: param(this.realmURL),
      generation: param(this.generation || null),
      ancestors: param(null),
      data: param(card.data ?? null),
      raw: param(new RawCardSerializer().serialize(card)),
      compiled: param(null),
      searchData: param(null),
      compileErrors: param(serializableError(err)),
      deps: param([...compiler.dependencies]),
    });
    this.touched.set(url, this.touchCounter++);
    await this.db.query(expressionToSql(expression));
  }

  async delete(url: string): Promise<void> {
    this.touched.set(url, this.touchCounter++);
    await this.db.query('DELETE FROM cards where url = $1', [url]);
    this.fileCache.deleteCardModules(url);
  }

  async beginReplaceAll(): Promise<void> {
    this.generation = Math.floor(Math.random() * 1000000000);
  }

  async finishReplaceAll(): Promise<void> {
    await this.db.query('DELETE FROM cards where realm = $1 AND (generation != $2 OR generation IS NULL)', [
      this.realmURL,
      this.generation,
    ]);
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

function readCursor(cursor: Cursor, rowCount: number): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    cursor.read(rowCount, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}
