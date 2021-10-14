"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCardCache = exports.createMinimalPackageJSON = exports.createCardCacheDir = exports.MINIMAL_PACKAGE = void 0;
const tmp_1 = __importDefault(require("tmp"));
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
tmp_1.default.setGracefulCleanup();
exports.MINIMAL_PACKAGE = {
    name: '@cardstack/compiled',
    exports: {
        '.': {
            browser: './browser',
            default: './node',
        },
        './*': {
            browser: './browser/*',
            default: './node/*',
        },
    },
};
function createCardCacheDir() {
    let tmpDir = tmp_1.default.dirSync().name;
    let cardCacheDir = path_1.join(tmpDir, 'node_modules', '@cardstack', 'compiled');
    fs_extra_1.ensureDirSync(cardCacheDir);
    createMinimalPackageJSON(cardCacheDir);
    return { tmpDir, cardCacheDir };
}
exports.createCardCacheDir = createCardCacheDir;
function createMinimalPackageJSON(cardCacheDir) {
    fs_extra_1.outputJSONSync(path_1.join(cardCacheDir, 'package.json'), exports.MINIMAL_PACKAGE);
}
exports.createMinimalPackageJSON = createMinimalPackageJSON;
function setupCardCache(mochaContext) {
    let _tmpDir, _cardCacheDir;
    function resolveCard(modulePath) {
        return require.resolve(modulePath, { paths: [_tmpDir] });
    }
    function getCardCacheDir() {
        return _cardCacheDir;
    }
    mochaContext.beforeEach(function () {
        let { tmpDir, cardCacheDir } = createCardCacheDir();
        createMinimalPackageJSON(cardCacheDir);
        _tmpDir = tmpDir;
        _cardCacheDir = cardCacheDir;
    });
    return { resolveCard, getCardCacheDir };
}
exports.setupCardCache = setupCardCache;
//# sourceMappingURL=cache.js.map