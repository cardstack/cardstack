"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_realm_1 = __importDefault(require("./realms/fs-realm"));
const errors_1 = require("./middleware/errors");
const path_1 = require("./utils/path");
class RealmManager {
    constructor(realmConfigs) {
        this.realms = realmConfigs.map((realm) => new fs_realm_1.default(realm, this));
    }
    createRealm(config, klass) {
        let realm = klass ? new klass(config, this) : new fs_realm_1.default(config, this);
        this.realms.push(realm);
        return realm;
    }
    getRealm(url) {
        url = path_1.ensureTrailingSlash(url);
        for (let realm of this.realms) {
            if (!url.startsWith(realm.url)) {
                continue;
            }
            return realm;
        }
        throw new errors_1.NotFound(`${url} is not a realm we know about`);
    }
    doesCardExist(url) {
        return this.getRealm(url).doesCardExist(url);
    }
    async getRawCard(url) {
        return this.getRealm(url).getRawCard(url);
    }
    async updateCardData(cardURL, attributes) {
        return this.getRealm(cardURL).updateCardData(cardURL, attributes);
    }
    async createDataCard(realmURL, data, adoptsFrom, cardURL) {
        let realm = this.getRealm(realmURL);
        return realm.createDataCard(data, adoptsFrom, cardURL);
    }
    async deleteCard(cardURL) {
        return this.getRealm(cardURL).deleteCard(cardURL);
    }
}
exports.default = RealmManager;
//# sourceMappingURL=realm-manager.js.map