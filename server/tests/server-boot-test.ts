import tmp from 'tmp';
import { ensureDirSync, outputJSONSync } from 'fs-extra';
import { join } from 'path';
import type Koa from 'koa';
import QUnit from 'qunit';
import { Server } from '../src/server';
// import { Project } from 'scenario-tester';
// import { setupCardCache } from './helpers/cache';

const realms = [
  // { url: 'https://my-realm', directory: realm.baseDir },
  {
    url: 'https://cardstack.com/base',
    directory: join(__dirname, '..', '..', 'base-cards'),
  },
];

QUnit.module('Server boot', function () {
  let server: Koa;

  QUnit.test(
    'Errors if cacheDir doesnt have a package.json in cardCarchDir',
    async function (assert) {
      let tmpDir = tmp.dirSync().name;
      let cardCacheDir = join(tmpDir, 'node_modules', '@cardstack', 'compiled');
      ensureDirSync(cardCacheDir);

      assert.rejects(
        Server.create({
          cardCacheDir,
          realms,
        }),
        /package.json is required in cardCacheDir/
      );
    }
  );

  QUnit.only(
    'Errors if cacheDirs package.json does not have proper exports',
    async function (assert) {
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
          realms,
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
          realms,
        }),
        /package.json of cardCacheDir does not have properly configured exports/
      );
    }
  );

  QUnit.test(
    'Errors if configured routing card does not have routeTo methods',
    async function (assert) {
      server = (
        await Server.create({
          cardCacheDir: '',
          realms,
        })
      ).app;

      assert.ok(server);
    }
  );
});
