"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tmp_1 = __importDefault(require("tmp"));
const cache_1 = require("../../src/cache");
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
const utils_1 = require("@cardstack/core/src/utils");
const chai_1 = require("chai");
describe('CardCache', function () {
    let cache;
    let tmpDir;
    let env = 'node';
    let moduleName = 'isolated.js';
    let cardURL = 'https://acard.com/verycard';
    this.beforeEach(async function () {
        tmpDir = tmp_1.default.dirSync().name;
        cache = new cache_1.CardCache(tmpDir, '@org/pkg');
    });
    it('.setModule', async function () {
        let moduleURL = cache.setModule(env, cardURL, moduleName, '{test: "test"}');
        chai_1.expect(moduleURL, 'moduleURL is correctly constructed and returned').to.equal('@org/pkg/https-acard.com-verycard/isolated.js');
        chai_1.expect(fs_extra_1.pathExistsSync(path_1.join(tmpDir, env, utils_1.encodeCardURL(cardURL), moduleName)), 'File is placed in <env>/<encoded-card-url>/<filename>').to.be.true;
    });
    it('.writeAsset', async function () {
        let filename = 'test.css';
        cache.writeAsset(cardURL, filename, 'body { background: red }');
        chai_1.expect(fs_extra_1.pathExistsSync(path_1.join(tmpDir, 'assets', utils_1.encodeCardURL(cardURL), filename)), 'Asset is placed in assets/<encoded-card-url>/<filename>').to.be.true;
        chai_1.expect(fs_extra_1.pathExistsSync(path_1.join(tmpDir, 'node', utils_1.encodeCardURL(cardURL), filename)), 'Symlink is created in node/<encoded-card-url>/<filename>').to.be.true;
        chai_1.expect(fs_extra_1.pathExistsSync(path_1.join(tmpDir, 'browser', utils_1.encodeCardURL(cardURL), filename)), 'Symlink is created in browser/<encoded-card-url>/<filename>').to.be.true;
    });
});
//# sourceMappingURL=cache-test.js.map