import type { RawCard, Builder } from '@cardstack/core/src/interfaces';
import type RealmManager from './services/realm-manager';
import type { Registry } from './di/dependency-injection';

const ENVIRONMENTS_OBJ = {
  browser: '',
  node: '',
};
export type Environment = keyof typeof ENVIRONMENTS_OBJ;
export const ENVIRONMENTS = Object.keys(ENVIRONMENTS_OBJ) as Environment[];
export const BROWSER = ENVIRONMENTS[0];
export const NODE = ENVIRONMENTS[1];

export interface HubServerConfig {
  port?: number;
  registryCallback?: undefined | ((registry: Registry) => void);
  routeCard?: string;
}

export interface CardStackContext {
  builder: Builder;
  cardRouter: any;
  realms: RealmManager;
  requireCard: (path: string) => any;
}

export interface RealmInterface {
  getRawCard(cardURL: string): Promise<RawCard>;
  updateCardData(cardURL: string, attributes: any): Promise<RawCard>;
  deleteCard(cardURL: string): void;
  doesCardExist(cardURL: string): boolean;
  createDataCard(data: any, adoptsFrom: string, cardURL?: string): Promise<RawCard>;
}

export interface Cache<CardType> {
  get(url: string): CardType | undefined;
  set(url: string, payload: CardType): void;
  update(url: string, payload: CardType): void;
  delete(url: string): void;
}
