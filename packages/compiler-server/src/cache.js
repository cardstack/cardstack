"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardCache = void 0;
const utils_1 = require("@cardstack/core/src/utils");
const interfaces_1 = require("./interfaces");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
class CardCache {
    constructor(dir, pkgName) {
        this.dir = dir;
        this.pkgName = pkgName;
    }
    getCardLocation(env, cardURL) {
        return path_1.join(this.dir, env, utils_1.encodeCardURL(cardURL));
    }
    getFileLocation(env, cardURL, localFile) {
        return path_1.join(this.getCardLocation(env, cardURL), localFile);
    }
    moduleURL(cardURL, localFile) {
        let encodedCardURL = utils_1.encodeCardURL(cardURL);
        return path_1.join(this.pkgName, encodedCardURL, localFile);
    }
    setModule(env, cardURL, localFile, source) {
        let fsLocation = this.getFileLocation(env, cardURL, localFile);
        this.writeFile(fsLocation, source);
        return this.moduleURL(cardURL, localFile);
    }
    writeAsset(cardURL, filename, source) {
        let assetPath = this.getFileLocation('assets', cardURL, filename);
        this.writeFile(assetPath, source);
        for (const env of interfaces_1.ENVIRONMENTS) {
            fs_extra_1.ensureSymlinkSync(assetPath, this.getFileLocation(env, cardURL, filename));
        }
        return assetPath;
    }
    writeFile(fsLocation, source) {
        fs_extra_1.mkdirpSync(path_1.dirname(fsLocation));
        fs_extra_1.writeFileSync(fsLocation, source);
    }
    setCard(cardURL, source) {
        this.setModule(interfaces_1.NODE, cardURL, 'compiled.json', JSON.stringify(source, null, 2));
    }
    getCard(cardURL, env = interfaces_1.NODE) {
        let loc = this.getFileLocation(env, utils_1.encodeCardURL(cardURL), 'compiled.json');
        if (fs_extra_1.existsSync(loc)) {
            return fs_extra_1.readJSONSync(loc);
        }
        return;
    }
    deleteCard(cardURL) {
        for (const env of interfaces_1.ENVIRONMENTS) {
            let loc = this.getCardLocation(env, cardURL);
            if (!fs_extra_1.existsSync(loc)) {
                continue;
            }
            fs_extra_1.removeSync(loc);
        }
    }
}
exports.CardCache = CardCache;
//# sourceMappingURL=cache.js.map