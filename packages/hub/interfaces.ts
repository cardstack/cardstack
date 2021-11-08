import type { RawCard, Builder } from '@cardstack/core/src/interfaces';
import type RealmManager from './services/realm-manager';

const ENVIRONMENTS_OBJ = {
  browser: '',
  node: '',
};
export type Environment = keyof typeof ENVIRONMENTS_OBJ;
export const ENVIRONMENTS = Object.keys(ENVIRONMENTS_OBJ) as Environment[];
export const BROWSER = ENVIRONMENTS[0];
export const NODE = ENVIRONMENTS[1];

export interface CardStackContext {
  builder: Builder;
  cardRouter: any;
  realms: RealmManager;
  requireCard: (path: string) => any;
}

export interface RealmInterface {
  read(cardURL: string): Promise<RawCard>;
  create(raw: RawCard | Omit<RawCard, 'url'>): Promise<RawCard>;
  update(raw: RawCard): Promise<RawCard>;
  delete(cardURL: string): Promise<void>;
}

export interface Cache<CardType> {
  get(url: string): CardType | undefined;
  set(url: string, payload: CardType): void;
  update(url: string, payload: CardType): void;
  delete(url: string): void;
}
