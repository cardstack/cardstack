import { expect } from 'chai';
import { outputJSONSync } from 'fs-extra';
import { join } from 'path';
import { configureHubWithCompiler } from '../helpers/cards';

if (process.env.COMPILER) {
  describe.skip('SearchIndex', function () {
    let { getRealmDir, getContainer, realmURL, cards } = configureHubWithCompiler(this);

    this.afterEach(async function () {
      let si = await getContainer().lookup('searchIndex');
      await si.reset();
    });

    this.beforeEach(async function () {
      let si = await getContainer().lookup('searchIndex');
      await si.reset();
      await si.indexAllRealms();
    });

    it(`gives a good error when a card can't compile`, async function () {
      outputJSONSync(join(getRealmDir(), 'example', 'card.json'), { adoptsFrom: '../post' });
      let si = await getContainer().lookup('searchIndex');
      await si.indexAllRealms();
      try {
        await cards.load(`${realmURL}example`);
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.eq(`Error: tried to adopt from card ${realmURL}post but it failed to load`);
        expect(err.status).to.eq(422);
      }
    });
  });
}
