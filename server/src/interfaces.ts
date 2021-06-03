import type Builder from '../src/builder';
import type {
  ComponentInfo,
  RealmConfig,
} from '@cardstack/core/src/interfaces';

const ENVIRONMENTS_OBJ = {
  browser: '',
  node: '',
};
export type Environment = keyof typeof ENVIRONMENTS_OBJ;
export const ENVIRONMENTS = Object.keys(ENVIRONMENTS_OBJ) as Environment[];
export const BROWSER = ENVIRONMENTS[0];
export const NODE = ENVIRONMENTS[1];

export interface ServerOptions {
  realms: RealmConfig[];
  cardCacheDir: string;
  routeCard?: string;
}

export interface CardStackContext {
  builder: Builder;
  cardRouter: any;
}

export type cardJSONReponse = {
  data: {
    id: string;
    type: string;
    attributes?: { [name: string]: any };
    meta: {
      componentModule: string;
      deserializationMap: ComponentInfo['deserialize'];
    };
  };
};
