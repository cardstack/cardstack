import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';
import { expect } from 'chai';
import { setupServer } from '../../helpers/server';

if (process.env.COMPILER) {
  describe('GET /cardFor/<path>', function () {
    function getCardForPath(path: string) {
      return request().get(`/cardFor/${path}`);
    }

    let { getCardService, resolveCard, getContainer, request, realm } = setupServer(this);

    this.beforeEach(async function () {
      let cards = await getCardService();

      await cards.create({
        url: `${realm}/routes`,
        schema: 'schema.js',
        files: {
          'schema.js': `
            export default class Routes {
              routeTo(path) {
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
      });
      let cardRoutes = await getContainer().lookup('card-routes');
      cardRoutes.setRoutingCard('https://my-realm/routes');

      await cards.create({
        url: `${realm}/homepage`,
        isolated: 'isolated.js',
        files: {
          'isolated.js': templateOnlyComponentTemplate('<h1>Welcome to my homepage</h1>'),
        },
      });
      await cards.create({
        url: `${realm}/about`,
        isolated: 'isolated.js',
        files: {
          'isolated.js': templateOnlyComponentTemplate('<div>I like trains</div>'),
        },
      });
    });

    it('404s when you try to load a path that the router doesnt have', async function () {
      // assert.expect(0);
      await getCardForPath('thing').expect(404);
    });

    it("can load a simple isolated card's data", async function () {
      let response = await getCardForPath('about').expect(200);
      expect(response.body.data.id).to.equal('https://my-realm/about');
      let componentModule = response.body.data?.meta.componentModule;
      expect(componentModule, 'should have componentModule').to.not.be.undefined;
      expect(resolveCard(componentModule), 'component module is resolvable').to.not.be.undefined;
    });
  });
}
