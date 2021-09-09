import tmp from 'tmp';
import { ensureDirSync, outputJSONSync } from 'fs-extra';
import { join } from 'path';
import QUnit from 'qunit';
import { Server } from '@cardstack/compiler-server';
import { createCardCacheDir, createMinimalPackageJSON } from './helpers/cache';
import { Project } from 'scenario-tester';
import { BASE_CARD_REALM_CONFIG } from './helpers/fixtures';
import RealmManager from '../src/realm-manager';

QUnit.module('Server boot', function () {
  QUnit.test('Errors if cacheDir doesnt have a package.json in cardCarchDir', async function (assert) {
    let tmpDir = tmp.dirSync().name;
    let cardCacheDir = join(tmpDir, 'node_modules', '@cardstack', 'compiled');
    ensureDirSync(cardCacheDir);

    assert.rejects(
      Server.create({
        cardCacheDir,
        realms: new RealmManager([BASE_CARD_REALM_CONFIG]),
      }),
      /package.json is required in cardCacheDir/
    );
  });

  QUnit.test('Errors if cacheDirs package.json does not have proper exports', async function (assert) {
    let tmpDir = tmp.dirSync().name;
    let cardCacheDir = join(tmpDir, 'node_modules', '@cardstack', 'compiled');
    ensureDirSync(cardCacheDir);
    outputJSONSync(join(cardCacheDir, 'package.json'), {
      name: '@cardstack/compiled',
      exports: { foo: 'bar.js ' },
    });

    assert.rejects(
      Server.create({
        cardCacheDir,
        realms: new RealmManager([BASE_CARD_REALM_CONFIG]),
      }),
      /package.json of cardCacheDir does not have properly configured exports/
    );

    outputJSONSync(join(cardCacheDir, 'package.json'), {
      name: '@cardstack/compiled',
      exports: { '.': { deno: '*' }, './*': { deno: '*' } },
    });

    assert.rejects(
      Server.create({
        cardCacheDir,
        realms: new RealmManager([BASE_CARD_REALM_CONFIG]),
      }),
      /package.json of cardCacheDir does not have properly configured exports/
    );
  });

  QUnit.test('Errors if configured routing card does not have routeTo methods', async function (assert) {
    let realm = new Project('my-realm', {
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

    let { cardCacheDir } = createCardCacheDir();
    createMinimalPackageJSON(cardCacheDir);

    assert.rejects(
      Server.create({
        cardCacheDir,
        realms: new RealmManager([{ url: 'https://my-realm', directory: realm.baseDir }, BASE_CARD_REALM_CONFIG]),
        routeCard: 'https://my-realm/routes',
      }),
      /Route Card's Schema does not have proper routing method defined/
    );
  });
});
