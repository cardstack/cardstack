"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const tmp_1 = __importDefault(require("tmp"));
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const compiler_server_1 = require("@cardstack/compiler-server");
const cache_1 = require("./helpers/cache");
const scenario_tester_1 = require("scenario-tester");
const fixtures_1 = require("./helpers/fixtures");
const realm_manager_1 = __importDefault(require("../src/realm-manager"));
describe('Server boot', function () {
    it('Errors if cacheDir doesnt have a package.json in cardCarchDir', async function () {
        let tmpDir = tmp_1.default.dirSync().name;
        let cardCacheDir = path_1.join(tmpDir, 'node_modules', '@cardstack', 'compiled');
        fs_extra_1.ensureDirSync(cardCacheDir);
        chai_1.expect(compiler_server_1.Server.create({
            cardCacheDir,
            realms: new realm_manager_1.default([fixtures_1.BASE_CARD_REALM_CONFIG]),
        })).to.be.rejectedWith(/package.json is required in cardCacheDir/);
    });
    it('Errors if cacheDirs package.json does not have proper exports', async function () {
        let tmpDir = tmp_1.default.dirSync().name;
        let cardCacheDir = path_1.join(tmpDir, 'node_modules', '@cardstack', 'compiled');
        fs_extra_1.ensureDirSync(cardCacheDir);
        fs_extra_1.outputJSONSync(path_1.join(cardCacheDir, 'package.json'), {
            name: '@cardstack/compiled',
            exports: { foo: 'bar.js ' },
        });
        chai_1.expect(compiler_server_1.Server.create({
            cardCacheDir,
            realms: new realm_manager_1.default([fixtures_1.BASE_CARD_REALM_CONFIG]),
        })).to.be.rejectedWith(/package.json of cardCacheDir does not have properly configured exports/);
        fs_extra_1.outputJSONSync(path_1.join(cardCacheDir, 'package.json'), {
            name: '@cardstack/compiled',
            exports: { '.': { deno: '*' }, './*': { deno: '*' } },
        });
        chai_1.expect(compiler_server_1.Server.create({
            cardCacheDir,
            realms: new realm_manager_1.default([fixtures_1.BASE_CARD_REALM_CONFIG]),
        })).to.be.rejectedWith(/package.json of cardCacheDir does not have properly configured exports/);
    });
    it('Errors if configured routing card does not have routeTo methods', async function () {
        let realm = new scenario_tester_1.Project('my-realm', {
            files: {
                routes: {
                    'card.json': JSON.stringify({
                        schema: 'schema.js',
                    }),
                    'schema.js': `
              export default class Routes {
                goToThisCardPLS(path) {
                  if (path === 'homepage') {
                    return 'https://my-realm/welcome';
                  }

                  if (path === 'about') {
                    return 'https://my-realm/about';
                  }
                }
              }
            `,
                },
            },
        });
        realm.writeSync();
        let { cardCacheDir } = cache_1.createCardCacheDir();
        cache_1.createMinimalPackageJSON(cardCacheDir);
        chai_1.expect(compiler_server_1.Server.create({
            cardCacheDir,
            realms: new realm_manager_1.default([{ url: 'https://my-realm', directory: realm.baseDir }, fixtures_1.BASE_CARD_REALM_CONFIG]),
            routeCard: 'https://my-realm/routes',
        })).to.be.rejectedWith(/Route Card's Schema does not have proper routing method defined/);
    });
});
//# sourceMappingURL=server-boot-test.js.map