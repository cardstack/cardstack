import type { RawCard, Builder } from '@cardstack/core/src/interfaces';
import type RealmManager from './realm-manager';
declare const ENVIRONMENTS_OBJ: {
    browser: string;
    node: string;
};
export declare type Environment = keyof typeof ENVIRONMENTS_OBJ;
export declare const ENVIRONMENTS: ("browser" | "node")[];
export declare const BROWSER: "browser" | "node";
export declare const NODE: "browser" | "node";
export interface ServerOptions {
    realms: RealmManager;
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
export {};
