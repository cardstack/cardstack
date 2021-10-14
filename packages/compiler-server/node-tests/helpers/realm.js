"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRealms = exports.ProjectTestRealm = void 0;
const scenario_tester_1 = require("scenario-tester");
const fixtures_1 = require("./fixtures");
const realm_manager_1 = __importDefault(require("../../src/realm-manager"));
const fs_realm_1 = __importDefault(require("../../src/realms/fs-realm"));
class ProjectTestRealm extends fs_realm_1.default {
    constructor(config, manager) {
        let project = new scenario_tester_1.Project(config.url);
        project.writeSync();
        config.directory = project.baseDir;
        super(config, manager);
        this.project = project;
    }
    addCard(cardID, files) {
        files['card.json'] = JSON.stringify(files['card.json'], null, 2);
        this.project.files[cardID] = files;
        this.project.writeSync();
    }
}
exports.ProjectTestRealm = ProjectTestRealm;
function setupRealms(mochaContext) {
    let realmConfigs = [fixtures_1.BASE_CARD_REALM_CONFIG];
    let realmManager;
    function createRealm(name) {
        return realmManager.createRealm({ url: name }, ProjectTestRealm);
    }
    mochaContext.beforeEach(function () {
        realmManager = new realm_manager_1.default(realmConfigs);
    });
    return {
        createRealm,
        getRealmManager() {
            return realmManager;
        },
    };
}
exports.setupRealms = setupRealms;
//# sourceMappingURL=realm.js.map