import { Environment } from './../../src/interfaces';
import tmp from 'tmp';
import { CardCache } from './../../src/cache';
import QUnit from 'qunit';
import { join } from 'path';
import { pathExistsSync } from 'fs-extra';
import { encodeCardURL } from '@cardstack/core/src/utils';

QUnit.module('CardCache', function (hooks) {
  let cache: CardCache;
  let tmpDir: string;
  let env: Environment = 'node';
  let moduleName = 'isolated.js';
  let cardURL = 'https://acard.com/verycard';

  hooks.beforeEach(async function () {
    tmpDir = tmp.dirSync().name;
    cache = new CardCache(tmpDir, '@org/pkg');
  });

  QUnit.test('.setModule', async function (assert) {
    let moduleURL = cache.setModule(env, cardURL, moduleName, '{test: "test"}');
    assert.equal(
      moduleURL,
      '@org/pkg/https-acard.com-verycard/isolated.js',
      'moduleURL is correctly constructed and returned'
    );
    assert.ok(
      pathExistsSync(join(tmpDir, env, encodeCardURL(cardURL), moduleName)),
      'File is placed in <env>/<encoded-card-url>/<filename>'
    );
  });

  QUnit.test('.writeAsset', async function (assert) {
    let filename = 'test.css';
    cache.writeAsset(cardURL, filename, 'body { background: red }');

    assert.ok(
      pathExistsSync(join(tmpDir, 'assets', encodeCardURL(cardURL), filename)),
      'Asset is placed in assets/<encoded-card-url>/<filename>'
    );
    assert.ok(
      pathExistsSync(join(tmpDir, 'node', encodeCardURL(cardURL), filename)),
      'Symlink is created in node/<encoded-card-url>/<filename>'
    );
    assert.ok(
      pathExistsSync(join(tmpDir, 'browser', encodeCardURL(cardURL), filename)),
      'Symlink is created in browser/<encoded-card-url>/<filename>'
    );
  });
});
