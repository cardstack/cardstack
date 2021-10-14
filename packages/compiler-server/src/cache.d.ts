import { CompiledCard } from '@cardstack/core/src/interfaces';
import { Environment } from './interfaces';
export declare class CardCache {
    private dir;
    private pkgName;
    constructor(dir: string, pkgName: string);
    private getCardLocation;
    private getFileLocation;
    private moduleURL;
    setModule(env: Environment, cardURL: string, localFile: string, source: string): string;
    writeAsset(cardURL: string, filename: string, source: string): string;
    private writeFile;
    setCard(cardURL: string, source: CompiledCard): void;
    getCard(cardURL: string, env?: Environment): CompiledCard | undefined;
    deleteCard(cardURL: string): void;
}
