"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestBuilder = void 0;
const compiler_1 = require("@cardstack/core/src/compiler");
const cache_1 = require("./cache");
const content_1 = require("@cardstack/core/src/utils/content");
const path_1 = require("../../src/utils/path");
const builder_1 = __importDefault(require("@cardstack/compiler-server/src/builder"));
const realm_manager_1 = __importDefault(require("../../src/realm-manager"));
const fixtures_1 = require("./fixtures");
const baseBuilder = (() => {
    let { cardCacheDir } = cache_1.createCardCacheDir();
    let realms = new realm_manager_1.default([fixtures_1.BASE_CARD_REALM_CONFIG]);
    return new builder_1.default({
        realms,
        cardCacheDir,
        pkgName: '@cardstack/compiled',
    });
})();
class TestBuilder {
    constructor() {
        this.rawCards = new Map();
        this.definedModules = new Map();
        this.compiler = new compiler_1.Compiler({
            builder: this,
        });
    }
    async getRawCard(url) {
        let card = this.rawCards.get(url);
        if (!card) {
            card = await baseBuilder.getRawCard(url);
        }
        return card;
    }
    async getCompiledCard(url) {
        let card = this.rawCards.get(url);
        if (card) {
            return await this.compiler.compile(card);
        }
        else {
            return await baseBuilder.getCompiledCard(url);
        }
    }
    async define(cardURL, localModule, type, src) {
        let moduleName = path_1.ensureTrailingSlash(cardURL) + localModule;
        switch (type) {
            case content_1.JS_TYPE:
                this.definedModules.set(moduleName, src);
                return moduleName;
            case content_1.CSS_TYPE:
                this.definedModules.set(moduleName, src);
                return moduleName;
            default:
                return moduleName;
        }
    }
    addRawCard(rawCard) {
        this.rawCards.set(rawCard.url, rawCard);
    }
}
exports.TestBuilder = TestBuilder;
//# sourceMappingURL=test-builder.js.map