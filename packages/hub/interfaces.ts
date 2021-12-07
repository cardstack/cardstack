import type { RawCard, Builder, NewRawCard, CardId } from '@cardstack/core/src/interfaces';
import type RealmManager from './services/realm-manager';
import { IndexerHandle } from './services/search-index';

const ENVIRONMENTS_OBJ = {
  browser: '',
  node: '',
};
export type Environment = keyof typeof ENVIRONMENTS_OBJ;
export const ENVIRONMENTS = Object.keys(ENVIRONMENTS_OBJ) as Environment[];
export const BROWSER = ENVIRONMENTS[0];
export const NODE = ENVIRONMENTS[1];

export interface CardstackContext {
  builder: Builder;
  cardRouter: any;
  realms: RealmManager;
  requireCard: (path: string) => any;
}

export interface RealmInterface<Meta = unknown> {
  url: string;
  read(cardId: CardId): Promise<RawCard>;
  create(raw: NewRawCard): Promise<RawCard>;
  update(raw: RawCard): Promise<RawCard>;
  delete(cardId: CardId): Promise<void>;
  reindex(ops: IndexerHandle, meta: Meta | undefined): Promise<Meta>;
  teardown(): Promise<void>;
}

export interface Cache<CardType> {
  get(url: string): CardType | undefined;
  set(url: string, payload: CardType): void;
  update(url: string, payload: CardType): void;
  delete(url: string): void;
}
