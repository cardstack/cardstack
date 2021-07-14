import type Builder from '../src/builder';
import type { RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import type RealmManager from './realm-manager';

const ENVIRONMENTS_OBJ = {
  browser: '',
  node: '',
};
export type Environment = keyof typeof ENVIRONMENTS_OBJ;
export const ENVIRONMENTS = Object.keys(ENVIRONMENTS_OBJ) as Environment[];
export const BROWSER = ENVIRONMENTS[0];
export const NODE = ENVIRONMENTS[1];

export interface ServerOptions {
  realmConfigs: RealmConfig[];
  cardCacheDir: string;
  routeCard?: string;
}

export interface CardStackContext {
  builder: Builder;
  cardRouter: any;
  realms: RealmManager;
  requireCard: (path: string) => any;
}

export interface RealmInterface {
  directory: string;
  getNextID(url: string): string;
  getRawCard(cardURL: string): RawCard;
  updateCardData(cardURL: string, attributes: any): void;
  deleteCard(cardURL: string): void;
}

export interface Cache<CardType> {
  get(url: string): CardType | undefined;
  set(url: string, payload: CardType): void;
  update(url: string, payload: CardType): void;
  delete(url: string): void;
}
