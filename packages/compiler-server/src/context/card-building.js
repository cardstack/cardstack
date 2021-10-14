"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupCardBuilding = void 0;
const isEqual_1 = __importDefault(require("lodash/isEqual"));
const builder_1 = __importDefault(require("../builder"));
const EXPORTS_PATHS = ['.', './*'];
const EXPORTS_ENVIRONMENTS = ['browser', 'default'];
function hasValidExports(pkg) {
    return EXPORTS_PATHS.every((key) => {
        return pkg[key] && isEqual_1.default(Object.keys(pkg[key]), EXPORTS_ENVIRONMENTS);
    });
}
function validateCacheDirSetup(cardCacheDir) {
    let pkg;
    try {
        pkg = require(`${cardCacheDir}/package.json`);
    }
    catch (error) {
        throw new Error('package.json is required in cardCacheDir');
    }
    if (!hasValidExports(pkg.exports)) {
        throw new Error('package.json of cardCacheDir does not have properly configured exports');
    }
}
function setupCardBuilding(app, options) {
    let { realms, cardCacheDir } = options;
    validateCacheDirSetup(cardCacheDir);
    app.context.requireCard = function (path) {
        const module = require.resolve(path, {
            paths: [cardCacheDir],
        });
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require(module);
    };
    app.context.realms = realms;
    app.context.builder = new builder_1.default({
        realms,
        cardCacheDir,
        pkgName: '@cardstack/compiled',
    });
}
exports.setupCardBuilding = setupCardBuilding;
//# sourceMappingURL=card-building.js.map