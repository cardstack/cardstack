"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const errors_1 = require("../middleware/errors");
const interfaces_1 = require("@cardstack/core/src/interfaces");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const walk_sync_1 = __importDefault(require("walk-sync"));
const errors_2 = require("../middleware/errors");
const path_2 = require("../utils/path");
const ids_1 = require("../utils/ids");
class FSRealm {
    constructor(config, manager) {
        this.url = config.url;
        this.directory = path_2.ensureTrailingSlash(config.directory);
        this.manager = manager;
    }
    doesCardExist(cardURL) {
        let cardLocation = path_1.join(this.directory, cardURL.replace(this.url, ''));
        return fs_extra_1.existsSync(cardLocation);
    }
    buildCardPath(cardURL, ...paths) {
        return path_1.join(this.directory, cardURL.replace(this.url, ''), ...(paths || ''));
    }
    getRawCardLocation(cardURL) {
        let cardLocation = this.buildCardPath(cardURL);
        if (fs_extra_1.existsSync(cardLocation)) {
            return cardLocation;
        }
        throw new errors_2.NotFound(`${cardURL} is not a card we know about`);
    }
    ensureIDIsUnique(url) {
        let path = this.buildCardPath(url);
        if (fs_extra_1.existsSync(path)) {
            throw new errors_1.Conflict(`Card with that ID already exists: ${url}`);
        }
    }
    async getRawCard(cardURL) {
        let dir = this.getRawCardLocation(cardURL);
        let files = {};
        for (let file of walk_sync_1.default(dir, {
            directories: false,
        })) {
            let fullPath = path_1.join(dir, file);
            files[file] = fs_extra_1.readFileSync(fullPath, 'utf8');
        }
        let cardJSON = files['card.json'];
        if (!cardJSON) {
            throw new Error(`${cardURL} is missing card.json`);
        }
        delete files['card.json'];
        let card = JSON.parse(cardJSON);
        Object.assign(card, { files, url: cardURL });
        interfaces_1.assertValidRawCard(card);
        return card;
    }
    async createDataCard(data, adoptsFrom, cardURL) {
        if (!adoptsFrom) {
            throw new Error('Card needs a parent!');
        }
        if (!this.manager.doesCardExist(adoptsFrom)) {
            throw new errors_2.NotFound(`Parent card does not exist: ${adoptsFrom}`);
        }
        if (!cardURL) {
            cardURL = await this.generateIdFromParent(adoptsFrom);
        }
        else {
            this.ensureIDIsUnique(cardURL);
        }
        let cardDir = this.buildCardPath(cardURL);
        fs_extra_1.ensureDirSync(cardDir);
        let card = {
            url: cardURL,
            adoptsFrom,
            data,
        };
        interfaces_1.assertValidRawCard(card);
        fs_extra_1.writeJsonSync(path_1.join(cardDir, 'card.json'), card);
        return card;
    }
    generateIdFromParent(url) {
        let name = url.replace(this.url, '');
        let id = ids_1.nanoid();
        return `${this.url}${name}-${id}`;
    }
    async updateCardData(cardURL, attributes) {
        let cardJSONPath = path_1.join(this.getRawCardLocation(cardURL), 'card.json');
        let card = fs_extra_1.readJsonSync(cardJSONPath);
        card.data = Object.assign(card.data, attributes);
        fs_extra_1.writeJsonSync(cardJSONPath, card);
        Object.assign(card, { url: cardURL });
        interfaces_1.assertValidRawCard(card);
        return card;
    }
    deleteCard(cardURL) {
        let cardDir = this.getRawCardLocation(cardURL);
        fs_extra_1.removeSync(cardDir);
    }
}
exports.default = FSRealm;
//# sourceMappingURL=fs-realm.js.map