"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const compiler_1 = require("@cardstack/core/src/compiler");
const core_1 = require("@babel/core");
const interfaces_1 = require("./interfaces");
const cache_1 = require("./cache");
const content_1 = require("@cardstack/core/src/utils/content");
class Builder {
    constructor(params) {
        this.compiler = new compiler_1.Compiler({
            builder: this,
        });
        this.realms = params.realms;
        this.cache = new cache_1.CardCache(params.cardCacheDir, params.pkgName);
    }
    async define(cardURL, localPath, type, source) {
        let url = this.cache.setModule(interfaces_1.BROWSER, cardURL, localPath, source);
        switch (type) {
            case content_1.JS_TYPE:
                this.cache.setModule(interfaces_1.NODE, cardURL, localPath, this.transformToCommonJS(localPath, source));
                return url;
            default:
                return this.cache.writeAsset(cardURL, localPath, source);
        }
    }
    transformToCommonJS(moduleURL, source) {
        let out = core_1.transformSync(source, {
            configFile: false,
            babelrc: false,
            filenameRelative: moduleURL,
            plugins: ['@babel/plugin-proposal-class-properties', '@babel/plugin-transform-modules-commonjs'],
        });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        return out.code;
    }
    async getRawCard(url) {
        url = url.replace(/\/$/, '');
        return this.realms.getRawCard(url);
    }
    async getCompiledCard(url) {
        let compiledCard = this.cache.getCard(url);
        if (compiledCard) {
            return compiledCard;
        }
        return this.buildCard(url);
    }
    async buildCard(url) {
        let rawCard = await this.getRawCard(url);
        let compiledCard = await this.compileCardFromRaw(rawCard);
        return compiledCard;
    }
    async compileCardFromRaw(rawCard) {
        let compiledCard = await this.compiler.compile(rawCard);
        this.cache.setCard(rawCard.url, compiledCard);
        return compiledCard;
    }
    async deleteCard(cardURL) {
        await this.cache.deleteCard(cardURL);
        await this.realms.deleteCard(cardURL);
    }
}
exports.default = Builder;
//# sourceMappingURL=builder.js.map