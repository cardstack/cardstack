import { Environment } from '../../src/interfaces';
import tmp from 'tmp';
import { CardCache } from '../../src/cache';
import { join } from 'path';
import { pathExistsSync } from 'fs-extra';
import { encodeCardURL } from '@cardstack/core/src/utils';
import { expect } from 'chai';

describe('CardCache', function () {
  let cache: CardCache;
  let tmpDir: string;
  let env: Environment = 'node';
  let moduleName = 'isolated.js';
  let cardURL = 'https://acard.com/verycard';

  this.beforeEach(async function () {
    tmpDir = tmp.dirSync().name;
    cache = new CardCache(tmpDir, '@org/pkg');
  });

  it('.setModule', async function () {
    let moduleURL = cache.setModule(env, cardURL, moduleName, '{test: "test"}');
    expect(moduleURL, 'moduleURL is correctly constructed and returned').to.equal(
      '@org/pkg/https-acard.com-verycard/isolated.js'
    );
    expect(
      pathExistsSync(join(tmpDir, env, encodeCardURL(cardURL), moduleName)),
      'File is placed in <env>/<encoded-card-url>/<filename>'
    ).to.be.true;
  });

  it('.writeAsset', async function () {
    let filename = 'test.css';
    cache.writeAsset(cardURL, filename, 'body { background: red }');

    expect(
      pathExistsSync(join(tmpDir, 'assets', encodeCardURL(cardURL), filename)),
      'Asset is placed in assets/<encoded-card-url>/<filename>'
    ).to.be.true;
    expect(
      pathExistsSync(join(tmpDir, 'node', encodeCardURL(cardURL), filename)),
      'Symlink is created in node/<encoded-card-url>/<filename>'
    ).to.be.true;
    expect(
      pathExistsSync(join(tmpDir, 'browser', encodeCardURL(cardURL), filename)),
      'Symlink is created in browser/<encoded-card-url>/<filename>'
    ).to.be.true;
  });
});
