import type { RawCard, Builder, Unsaved, CardId } from '@cardstack/core/src/interfaces';
import type RealmManager from './services/realm-manager';
import { IndexerHandle } from './services/search-index';
import { PgPrimitive } from './utils/expressions';

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

export interface RealmInterface<Meta = PgPrimitive> {
  url: string;
  read(cardId: CardId): Promise<RawCard>;
  create(raw: RawCard<Unsaved>): Promise<RawCard>;
  update(raw: RawCard): Promise<RawCard>;
  delete(cardId: CardId): Promise<void>;
  reindex(ops: IndexerHandle, meta: Meta | null): Promise<Meta>;
  teardown(): Promise<void>;
}

export interface Cache<CardType> {
  get(url: string): CardType | undefined;
  set(url: string, payload: CardType): void;
  update(url: string, payload: CardType): void;
  delete(url: string): void;
}
