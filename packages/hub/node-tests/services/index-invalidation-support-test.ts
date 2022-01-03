import { Client } from 'pg';
import { configureHubWithCompiler } from '../helpers/cards';

if (process.env.COMPILER) {
  describe.only('Index invalidation DB support', function () {
    let client: Client;
    let { getContainer, realmURL, cards } = configureHubWithCompiler(this);

    this.beforeEach(async function () {
      let dbManager = await getContainer().lookup('database-manager');
      client = await dbManager.getClient();

      await cards.create({
        id: 'grandparent',
        realm: realmURL,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from '@cardstack/types';
            import string from 'https://cardstack.com/base/string';
            export default class Grandparent {
              @contains(string) title;
            }
          `,
        },
      });
      await cards.create({
        id: 'parent',
        realm: realmURL,
        adoptsFrom: '../grandparent',
      });
      await cards.create({
        id: 'grandchild',
        realm: realmURL,
        adoptsFrom: '../parent',
      });
    });

    it('can retrieve cards deps from the index in ascending order', async function () {
      let grandparentURL = `${realmURL}grandparent`;
      let { rows } = await client.query(
        `select url, (url, deps)::card_dep as c_dep from cards where '{${grandparentURL}}' && deps order by c_dep using >^;`
      );
      expect(rows.length).to.eq(2);
      expect(rows[0].url).to.eq(`${realmURL}parent`);
      expect(rows[1].url).to.eq(`${realmURL}grandchild`);
    });

    it('can retrieve cards deps from the index in descending order', async function () {
      let grandparentURL = `${realmURL}grandparent`;
      let { rows } = await client.query(
        `select url, (url, deps)::card_dep as c_dep from cards where '{${grandparentURL}}' && deps order by c_dep using <^;`
      );
      expect(rows.length).to.eq(2);
      expect(rows[0].url).to.eq(`${realmURL}grandchild`);
      expect(rows[1].url).to.eq(`${realmURL}parent`);
    });
  });
}
