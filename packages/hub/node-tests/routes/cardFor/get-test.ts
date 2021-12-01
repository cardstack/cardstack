import { TEST_REALM, templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers';
import { expect } from 'chai';
import { registry, setupHub } from '../../helpers/server';

if (process.env.COMPILER) {
  describe('GET /cardFor/<path>', function () {
    function getCardForPath(path: string) {
      return request().get(`/cardFor/${path}`);
    }

    this.beforeEach(function () {
      registry(this).register(
        'card-routes-config',
        class {
          routeCard = `${TEST_REALM}routes`;
        }
      );
    });

    let { cards, resolveCard, request, realm } = setupHub(this);

    this.beforeEach(async function () {
      await cards.create({
        url: `${realm}routes`,
        schema: 'schema.js',
        files: {
          'schema.js': `
            export default class Routes {
              routeTo(path) {
                if (path === 'homepage') {
                  return '${TEST_REALM}welcome';
                }

                if (path === 'about') {
                  return '${TEST_REALM}about';
                }
              }
            }
          `,
        },
      });
      await cards.create({
        url: `${realm}homepage`,
        isolated: 'isolated.js',
        files: {
          'isolated.js': templateOnlyComponentTemplate('<h1>Welcome to my homepage</h1>'),
        },
      });
      await cards.create({
        url: `${realm}about`,
        isolated: 'isolated.js',
        files: {
          'isolated.js': templateOnlyComponentTemplate('<div>I like trains</div>'),
        },
      });
    });

    it('404s when you try to load a path that the router doesnt have', async function () {
      await getCardForPath('thing').expect(404);
    });

    it("can load a simple isolated card's data", async function () {
      let response = await getCardForPath('about').expect(200);
      expect(response.body.data.id).to.equal(`${TEST_REALM}about`);
      let componentModule = response.body.data?.meta.componentModule;
      expect(componentModule, 'should have componentModule').to.not.be.undefined;
      expect(resolveCard(componentModule), 'component module is resolvable').to.not.be.undefined;
    });
  });
}
