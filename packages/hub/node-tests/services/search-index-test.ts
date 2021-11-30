import { expect } from 'chai';
import { setupHub } from '../helpers/server';
import { outputJSONSync } from 'fs-extra';
import { join } from 'path';

if (process.env.COMPILER) {
  describe.skip('SearchIndex', function () {
    this.afterEach(async function () {
      let si = await getContainer().lookup('searchIndex');
      await si.reset();
    });
    let { getContainer, cards, realm, getRealmDir } = setupHub(this);

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
        await cards.load(`${realm}example`);
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.eq(`Error: tried to adopt from card ${realm}post but it failed to load`);
        expect(err.status).to.eq(422);
      }
    });
  });
}
