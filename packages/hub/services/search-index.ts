import { CompiledCard, RawCard } from '@cardstack/core/src/interfaces';
import { inject } from '@cardstack/di';

export class SearchIndex {
  private realmManager = inject('realm-manager', { as: 'realmManager' });
  private database = inject('database-manager', { as: 'database' });

  async indexAllRealms(): Promise<void> {
    let { ops, finalize } = IndexingOperations.create();
    let promises = this.realmManager.realms.map((realm) => realm.reindex(ops));
    await finalize();
    await Promise.all(promises);
  }

  async indexCard(raw: RawCard): Promise<CompiledCard> {}
}

export class IndexingOperations {
  static create() {
    let ops = new this();
    return {
      ops,
      finalize: async () => {
        await ops.finalize();
      },
    };
  }

  private async finalize() {}

  async save(card: RawCard): Promise<void> {}

  async delete(cardURL: string): Promise<void> {}

  async beginReplaceAll(): Promise<void> {}

  async finishReplaceAll(): Promise<void> {}
}

declare module '@cardstack/di' {
  interface KnownServices {
    searchIndex: SearchIndex;
  }
}
