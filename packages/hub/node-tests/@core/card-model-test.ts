// eslint-disable-next-line node/no-extraneous-import
import { parse, isSameDay } from 'date-fns';
import { expect } from 'chai';

import { ADDRESS_RAW_CARD, PERSON_RAW_CARD } from '@cardstack/core/tests/helpers/fixtures';
import { configureHubWithCompiler } from '../helpers/cards';
import merge from 'lodash/merge';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers';
import cloneDeep from 'lodash/cloneDeep';
import { CardModel } from '@cardstack/core/src/interfaces';

function p(dateString: string): Date {
  return parse(dateString, 'yyyy-MM-dd', new Date());
}

let attributes: Record<string, any> = {
  name: 'Bob Barker',
  birthdate: '1923-12-12',
  address: {
    street: '101 Price is Right ln',
    city: 'Los Angeles',
    state: 'CA',
    settlementDate: '1990-01-01',
    zip: null,
  },
};

if (process.env.COMPILER) {
  describe('CardModel', function () {
    let { realmURL, cards } = configureHubWithCompiler(this);

    this.beforeEach(async function () {
      await cards.create(ADDRESS_RAW_CARD);
      await cards.create(
        merge({}, PERSON_RAW_CARD, {
          embedded: 'embedded.js',
          files: {
            // make sure to use the birthdate and address fields
            'isolated.js': templateOnlyComponentTemplate(
              `<div class="person-isolated" data-test-person>Hi! I am <@fields.name/><@fields.birthdate/><@fields.address/></div>`
            ),
            // address field is not used in the embedded view
            'embedded.js': templateOnlyComponentTemplate(
              `<div class="person-isolated" data-test-person>Hi! I am <@fields.name/><@fields.birthdate/></div>`
            ),
          },
        })
      );
      await cards.create({
        id: 'bob-barker',
        realm: realmURL,
        adoptsFrom: '../person',
        data: attributes,
      });
    });

    it('.data', async function () {
      let model: CardModel = await cards.loadModel(`${realmURL}bob-barker`, 'isolated');
      expect(await model.getField('name')).to.equal(attributes.name);
      expect(isSameDay(await model.getField('birthdate'), p('1923-12-12')), 'Dates are serialized to Dates').to.be.ok;
      expect(await model.getField('address.street')).to.equal(attributes.address.street);
      expect(
        isSameDay(await model.getField('address.settlementDate'), p('1990-01-01')),
        'Dates are serialized to Dates'
      ).to.be.ok;
    });

    it('.url on new card throws error', async function () {
      let parentCard = await cards.loadModel(`${realmURL}person`, 'isolated');
      let model = parentCard.adoptIntoRealm(realmURL);
      try {
        model.url;
        throw new Error('did not throw expected error');
      } catch (e: any) {
        expect(e.message).to.equal(`bug: card in state created does not have a url`);
      }
    });

    it('.save() created card', async function () {
      let parentCard = await cards.loadModel(`${realmURL}person`, 'isolated');
      let model = parentCard.adoptIntoRealm(realmURL);
      await model.setData({ name: 'Kirito', address: { settlementDate: p('2022-02-22') } });
      expect((await model.getField('address.settlementDate')) instanceof Date).to.be.true;
      expect(
        isSameDay(await model.getField('address.settlementDate'), p('2022-02-22')),
        'Dates are serialized to Dates'
      ).to.be.ok;
      await model.save();

      let kirito = await cards.loadModel(model.url, 'isolated');
      expect(await kirito.getField('name')).to.equal('Kirito');
      expect((await kirito.getField('address.settlementDate')) instanceof Date).to.be.true;
      expect(
        isSameDay(await kirito.getField('address.settlementDate'), p('2022-02-22')),
        'Dates are serialized to Dates'
      ).to.be.ok;
    });

    it('.save() loaded card - isolated', async function () {
      let model = await cards.loadModel(`${realmURL}bob-barker`, 'isolated');
      await model.setData({ name: 'Robert Barker' });
      await model.save();

      expect(model.format).to.equal('isolated');
      expect(await model.getField('name')).to.equal('Robert Barker');
      expect(isSameDay(await model.getField('birthdate'), p('1923-12-12')), 'Dates are serialized to Dates').to.be.ok;

      await model.setData({ birthdate: p('2022-02-22') });

      expect(isSameDay(await model.getField('birthdate'), p('2022-02-22')), 'Dates are serialized to Dates').to.be.ok;

      await model.save();

      expect(isSameDay(await model.getField('birthdate'), p('2022-02-22')), 'Dates are serialized to Dates').to.be.ok;

      let savedModel = await cards.loadModel(`${realmURL}bob-barker`, 'isolated');
      expect(await savedModel.getField('name')).to.equal('Robert Barker');
      expect(isSameDay(await savedModel.getField('birthdate'), p('2022-02-22')), 'Dates are serialized to Dates').to.be
        .ok;
      // fields that were not specified in setData should be unchanged
      expect(await savedModel.getField('address.city')).to.equal('Los Angeles');
      let embedded = await cards.loadModel(`${realmURL}bob-barker`, 'embedded');
      expect(await embedded.getField('name')).to.equal('Robert Barker');
      expect(isSameDay(await embedded.getField('birthdate'), p('2022-02-22')), 'Dates are serialized to Dates').to.be
        .ok;
    });

    it('.save() loaded card - embedded', async function () {
      let model = await cards.loadModel(`${realmURL}bob-barker`, 'embedded');
      await model.setData({ name: 'Robert Barker' });
      await model.save();

      expect(await model.getField('name')).to.equal('Robert Barker');
      expect(model.format).to.equal('embedded');

      let savedModel = await cards.loadModel(`${realmURL}bob-barker`, 'embedded');
      expect(await savedModel.getField('name')).to.equal('Robert Barker');
      let isolated = await cards.loadModel(`${realmURL}bob-barker`, 'isolated');
      expect(await isolated.getField('name')).to.equal('Robert Barker');
    });

    it('.save() on adopted card using pre-existing id', async function () {
      let id = 'bob-barker';
      let parentCard = await cards.loadModel(`${realmURL}person`, 'isolated');
      let model = parentCard.adoptIntoRealm(realmURL, id);
      try {
        await model.save();
        throw new Error('did not throw expected error');
      } catch (e: any) {
        expect(e.message).to.equal(`card ${realmURL}${id} already exists`);
      }
    });

    it('setData of unused field', async function () {
      let model = await cards.loadModel(`${realmURL}bob-barker`, 'embedded');
      try {
        await model.setData({
          name: 'Robert Barker',
          pizza: 'pepperoni', // non-existent field
          address: { city: 'New York' }, // unused field (which is ok to set)
        });
        throw new Error('did not throw expected error');
      } catch (e: any) {
        expect(e.message).to.equal(`the field(s) 'pizza' are not allowed to be set for the card ${realmURL}bob-barker`);
      }
    });

    it('.serialize isolated card', async function () {
      let model = await cards.loadModel(`${realmURL}bob-barker`, 'isolated');
      let result = model.serialize();

      expect(result.meta?.componentModule).to.eq('@cardstack/compiled/https-cardstack.local-person/isolated.js');
      delete result.meta;

      let expectedAttributes = cloneDeep(attributes);

      expect(result).to.deep.equal({
        id: `${realmURL}bob-barker`,
        type: 'card',
        attributes: expectedAttributes,
      });
    });

    it('.serialize embedded card', async function () {
      let model = await cards.loadModel(`${realmURL}bob-barker`, 'embedded');
      let result = model.serialize();

      expect(result.meta?.componentModule).to.eq('@cardstack/compiled/https-cardstack.local-person/embedded.js');
      delete result.meta;

      let expectedAttributes = cloneDeep(attributes);
      delete expectedAttributes.address;

      expect(result).to.deep.equal({
        id: `${realmURL}bob-barker`,
        type: 'card',
        attributes: expectedAttributes,
      });
    });

    it('.serialize card model in created state', async function () {
      let parent = await cards.loadModel(`${realmURL}person`, 'isolated');
      let model = parent.adoptIntoRealm(realmURL);
      await model.setData(attributes);
      let result = model.serialize();

      let expectedAttributes = cloneDeep(attributes);

      expect(result).to.deep.equal({
        id: undefined,
        type: 'card',
        attributes: expectedAttributes,
      });

      // do we want to also include the meta.componentModule in this state?
    });

    it(`can recover from error in userland field code`, async function () {
      await cards.create({
        id: 'boom',
        realm: realmURL,
        schema: 'schema.js',
        files: {
          'schema.js': `
            import { contains } from '@cardstack/types';
            import string from 'https://cardstack.com/base/string';
            export default class Boom {
              @contains(string) willBoom;
              @contains(string)
              get boom() {
                if (this.willBoom === 'true') {
                  throw new Error('boom');
                } else {
                  return 'no boom';
                }
              }
            }
          `,
        },
      });

      let model = await cards.loadModel(`${realmURL}boom`, 'isolated');
      try {
        await model.setData({ willBoom: 'true' });
        throw new Error('failed to throw expected exception');
      } catch (err: any) {
        expect(err.message).to.eq(`Could not load field 'boom' for card ${realmURL}boom`);
        expect(err.status).to.eq(422);
        let innerError = err.additionalErrors?.[0];
        expect(innerError?.message).to.eq(`boom`);
      }
      await model.setData({ willBoom: 'false' });
      expect(await model.getField('boom')).to.eq('no boom');
    });
  });
}
