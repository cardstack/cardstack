import { Environment } from '../../interfaces';
import { expect } from 'chai';
import FileCache from '../../services/file-cache';
import { setupHub } from '../helpers/server';

if (process.env.COMPILER) {
  describe('FileCache', function () {
    let cache: FileCache;
    let env: Environment = 'node';
    let moduleName = 'isolated.js';
    let cardURL = 'https://acard.com/verycard';

    let { getContainer } = setupHub(this);

    this.beforeEach(async function () {
      cache = await getContainer().lookup('file-cache', { type: 'service' });
    });

    it('.setModule', function () {
      let moduleURL = cache.setModule(env, cardURL, moduleName, '{test: "test"}');
      expect(moduleURL, 'moduleURL is correctly constructed and returned').to.equal(
        '@cardstack/compiled/https-acard.com-verycard/isolated.js'
      );
      expect(cache.entryExists(env, cardURL, moduleName), 'File is placed in <env>/<encoded-card-url>/<filename>').to.be
        .true;
    });

    it('.writeAsset', async function () {
      let filename = 'test.css';
      cache.writeAsset(cardURL, filename, 'body { background: red }');

      expect(cache.entryExists('assets', cardURL, filename), 'Asset is placed in assets/<encoded-card-url>/<filename>')
        .to.be.true;
      expect(cache.entryExists('node', cardURL, filename), 'Symlink is created in node/<encoded-card-url>/<filename>')
        .to.be.true;
      expect(
        cache.entryExists('browser', cardURL, filename),
        'Symlink is created in browser/<encoded-card-url>/<filename>'
      ).to.be.true;
    });
  });
}
