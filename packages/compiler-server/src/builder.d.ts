import { Builder as BuilderInterface, RawCard, CompiledCard } from '@cardstack/core/src/interfaces';
import RealmManager from './realm-manager';
export default class Builder implements BuilderInterface {
    private compiler;
    private realms;
    private cache;
    constructor(params: {
        realms: RealmManager;
        cardCacheDir: string;
        pkgName: string;
    });
    define(cardURL: string, localPath: string, type: string, source: string): Promise<string>;
    private transformToCommonJS;
    getRawCard(url: string): Promise<RawCard>;
    getCompiledCard(url: string): Promise<CompiledCard>;
    buildCard(url: string): Promise<CompiledCard>;
    private compileCardFromRaw;
    deleteCard(cardURL: string): Promise<void>;
}
