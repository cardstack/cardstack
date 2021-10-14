import Koa from 'koa';
import { CardStackContext } from '../interfaces';
import RealmManager from '../realm-manager';
export declare function setupCardBuilding(app: Koa<any, CardStackContext>, options: {
    realms: RealmManager;
    cardCacheDir: string;
}): void;
