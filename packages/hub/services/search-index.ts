import { CompiledCard, RawCard } from '@cardstack/core/src/interfaces';
import { inject } from '@cardstack/di';

export class SearchIndex {
  private realmManager = inject('realm-manager', { as: 'realmManager' });
  // private database = inject('database-manager', { as: 'database' });

  async indexAllRealms(): Promise<void> {
    let { ops, finalize } = IndexingOperations.create();
    let promises = this.realmManager.realms.map((realm) => realm.reindex(ops, undefined));
    await Promise.all(promises);
    await finalize();
  }

  async indexCard(raw: RawCard): Promise<CompiledCard> {
    let { ops, finalize } = IndexingOperations.create();
    await ops.save(raw);
    await finalize();
    throw new Error('unimplemented');
  }

  notify(_cardURL: string, _action: 'save' | 'delete'): void {
    throw new Error('not implemented');
  }
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

  async save(card: RawCard): Promise<void> {
    console.log(`TODO save ${card.url}`);
  }

  async delete(cardURL: string): Promise<void> {
    console.log(`TODO delete ${cardURL}`);
  }

  async beginReplaceAll(): Promise<void> {}

  async finishReplaceAll(): Promise<void> {}
}

declare module '@cardstack/di' {
  interface KnownServices {
    searchIndex: SearchIndex;
  }
}
