/// <reference types="mocha" />
export declare const MINIMAL_PACKAGE: {
    name: string;
    exports: {
        '.': {
            browser: string;
            default: string;
        };
        './*': {
            browser: string;
            default: string;
        };
    };
};
export declare function createCardCacheDir(): {
    tmpDir: string;
    cardCacheDir: string;
};
export declare function createMinimalPackageJSON(cardCacheDir: string): void;
export declare function setupCardCache(mochaContext: Mocha.Suite): {
    resolveCard: (modulePath: string) => string;
    getCardCacheDir: () => string;
};
