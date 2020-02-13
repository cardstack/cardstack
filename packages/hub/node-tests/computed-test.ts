import { AddressableCard } from '@cardstack/core/card';
import { myOrigin } from '@cardstack/core/origin';
import { Session } from '@cardstack/core/session';
import { createTestEnv, TestEnv } from './helpers';
import { cardDocument } from '@cardstack/core/card-document';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';

describe('hub/computed-fields', function() {
  describe('simplest computed field', function() {
    let env: TestEnv;
    let card: AddressableCard;

    before(async function() {
      env = await createTestEnv();
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let plusOne = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .withAttributes({
            csFiles: {
              'compute.js': `module.exports = async function() { return { value: 1 + 1 }; }`,
            },
            csFeatures: {
              compute: 'compute.js',
            },
          })
          .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'integer-field' }).jsonapi
      );
      card = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument().withField('count', plusOne).jsonapi
      );
    });

    after(async function() {
      await env.destroy();
    });

    it('exposes computed value', async function() {
      expect(await card.value('count')).to.equal(2);
    });

    it('includes computed value in "everything" serialization', async function() {
      let jsonapi = await card.serializeAsJsonAPIDoc({ includeFieldSet: 'everything' });
      expect(jsonapi.data.attributes).to.have.property('count', 2);
    });

    it('does not include computed value in "upstream" serialization', async function() {
      let jsonapi = await card.serializeAsJsonAPIDoc({ includeFieldSet: 'upstream' });
      expect(jsonapi.data.attributes).not.to.have.property('count');
    });

    it('includes computed value when explicitly included in serialization', async function() {
      let jsonapi = await card.serializeAsJsonAPIDoc({ includeFields: ['count'] });
      expect(jsonapi.data.attributes).to.have.property('count', 2);
    });

    it('can run searches against computed values', async function() {
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let results = await service.search({ filter: { type: card, eq: { count: 2 } } });
      expect(results.cards).to.have.length(1);
    });
  });
});
