"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWatchers = exports.primeCache = exports.cleanCache = void 0;
const interfaces_1 = require("./interfaces");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const walk_sync_1 = __importDefault(require("walk-sync"));
const sane_1 = __importDefault(require("sane"));
const path_2 = require("path");
function cleanCache(dir) {
    console.debug('Cleaning cardCache dir: ' + dir);
    for (let subDir of interfaces_1.ENVIRONMENTS) {
        fs_extra_1.removeSync(path_1.join(dir, subDir));
    }
    fs_extra_1.removeSync(path_1.join(dir, 'assets'));
}
exports.cleanCache = cleanCache;
async function primeCache(realManager, builder) {
    let promises = [];
    for (let realm of realManager.realms) {
        let cards = walk_sync_1.default(realm.directory, { globs: ['**/card.json'] });
        for (let cardPath of cards) {
            let fullCardUrl = new URL(cardPath.replace('card.json', ''), realm.url).href;
            console.debug(`--> Priming cache for ${fullCardUrl}`);
            promises.push(builder.buildCard(fullCardUrl));
        }
    }
    await Promise.all(promises);
    console.debug(`--> Cache primed`);
}
exports.primeCache = primeCache;
function setupWatchers(realmManager, builder) {
    return realmManager.realms.map((realm) => {
        let watcher = sane_1.default(realm.directory);
        const handler = (filepath /* root: string, stat?: Stats */) => {
            let segments = filepath.split(path_2.sep);
            if (segments.length < 2) {
                // top-level files in the realm are not cards, we're assuming all
                // cards are directories under the realm.
                return;
            }
            let url = new URL(segments[0] + '/', realm.url).href;
            console.debug(`!-> rebuilding card ${url}`);
            (async () => {
                try {
                    await builder.buildCard(url);
                }
                catch (err) {
                    console.log(err);
                }
            })();
        };
        watcher.on('add', handler);
        watcher.on('change', handler);
        watcher.on('delete', handler);
        return watcher;
    });
}
exports.setupWatchers = setupWatchers;
//# sourceMappingURL=watcher.js.map