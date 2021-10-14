import { CompiledCard, Builder as BuilderInterface, RawCard } from '@cardstack/core/src/interfaces';
import { Compiler } from '@cardstack/core/src/compiler';
export declare class TestBuilder implements BuilderInterface {
    compiler: Compiler;
    rawCards: Map<string, RawCard>;
    definedModules: Map<string, string>;
    constructor();
    getRawCard(url: string): Promise<RawCard>;
    getCompiledCard(url: string): Promise<CompiledCard>;
    define(cardURL: string, localModule: string, type: string, src: string): Promise<string>;
    addRawCard(rawCard: RawCard): void;
}
