import { AddressableCard } from '../card';
import { myOrigin } from '../origin';
import { Session } from '../session';
import { createTestEnv, TestEnv } from './helpers';
import { cardDocument } from '../card-document';
import { CARDSTACK_PUBLIC_REALM } from '../realm';
import { ScopedCardService } from '../cards-service';

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

  describe('dependencies', function() {
    let env: TestEnv;
    let service: ScopedCardService;
    let templateCard: AddressableCard;
    let plusOne: AddressableCard;

    before(async function() {
      env = await createTestEnv();
      service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      plusOne = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .withAttributes({
            csFiles: {
              'compute.js': `module.exports = async function({ field, card }) {
                let otherFieldName = await field.value('otherFieldName');
                let otherFieldValue = await card.value(otherFieldName);
                return { value: otherFieldValue + 1 };
              }
              `,
            },
            csFeatures: {
              compute: 'compute.js',
            },
          })
          .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'integer-field' }).jsonapi
      );
      templateCard = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .withField('agePlusOne', plusOne, 'singular', { otherFieldName: 'age' })
          .withField('age', 'integer-field')
          .withField('height', 'integer-field').jsonapi
      );
    });

    after(async function() {
      await env.destroy();
    });

    it('computes correctly the first time', async function() {
      let card = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .adoptingFrom(templateCard)
          .withAttributes({ age: 8 }).jsonapi
      );
      expect(await card.value('agePlusOne')).to.equal(9);
    });

    it('recomputes when a dependent field in the same card changes', async function() {
      let card = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .adoptingFrom(templateCard)
          .withAttributes({ age: 8 }).jsonapi
      );
      card = await service.update(card, cardDocument().withAttributes({ age: 9 }).jsonapi);
      expect(await card.value('age')).to.equal(9);
      expect(await card.value('agePlusOne')).to.equal(10);
    });

    it('recomputes when a field in the computed field itself changes', async function() {
      let card = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .adoptingFrom(templateCard)
          .withAttributes({ age: 8, height: 40 }).jsonapi
      );
      let doc = (await templateCard.serializeAsJsonAPIDoc()) as any;
      doc.data.attributes.csFields.agePlusOne.attributes.otherFieldName = 'height';
      let modified = await templateCard.patch(doc);
      await service.update(templateCard, await modified.serializeAsJsonAPIDoc({ includeFieldSet: 'upstream' }));
      card = await service.get(card);
      expect(await card.value('agePlusOne')).to.equal(41);
    });
  });

  describe('queries', function() {
    let env: TestEnv;
    let thePost: AddressableCard;
    this.timeout(10000);

    before(async function() {
      env = await createTestEnv();
      let service = await (await env.container.lookup('cards')).as(Session.EVERYONE);
      let reverseLookup = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument().withAttributes({
          csFiles: {
            'compute.js': `module.exports = async function({ field, card }) {
              let foreignKey = await field.value('foreignKey');
              let foreignType = await field.value('foreignType');
              try {
                debugger

                let found = await card.reader.search({
                  filter: {
                    type: foreignType,
                    eq: {
                     [foreignKey + '.csId']:  card.csId,
                     [foreignKey + '.csRealm']:  card.csRealm,
                     [foreignKey + '.csOriginalRealm']:  card.csOriginalRealm
                    },
                  },
                });

                return { value: found.cards };
              } catch (err) {
                return { value: [] };
              }
            }`,
            'query.js': `module.exports = async function(expression, fieldName) {
              console.log('I can has query?')
            }`,
          },
          csFeatures: {
            compute: 'compute.js',
            'field-buildQueryExpression': 'query.js',
          },
        }).jsonapi
      );

      let Post = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .withField('comments', reverseLookup, 'plural', {
            foreignKey: 'post',
            foreignType: { csRealm: `${myOrigin}/api/realms/first-ephemeral-realm`, csId: 'comment' },
          })
          .withField('title', 'string-field').jsonapi
      );

      let Comment = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .withAttributes({ csId: 'comment' })
          .withField('post', Post)
          .withField('message', 'string-field').jsonapi
      );

      thePost = await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .adoptingFrom(Post)
          .withAttributes({ title: 'The Post' }).jsonapi
      );

      await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .adoptingFrom(Comment)
          .withAttributes({ message: 'Hello' })
          .withRelationships({ post: thePost }).jsonapi
      );

      await service.create(
        `${myOrigin}/api/realms/first-ephemeral-realm`,
        cardDocument()
          .adoptingFrom(Comment)
          .withAttributes({ message: 'Goodbye' })
          .withRelationships({ post: thePost }).jsonapi
      );
    });

    after(async function() {
      await env.destroy();
    });

    it('exposes computed value', async function() {
      let comments = await thePost.value('comments');
      expect(comments).has.length(2);
    });
  });
});
