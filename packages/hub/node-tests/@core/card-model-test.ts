// eslint-disable-next-line node/no-extraneous-import
import { parse, isSameDay } from 'date-fns';
import { expect } from 'chai';

import { ADDRESS_RAW_CARD, PERSON_RAW_CARD } from '@cardstack/core/tests/helpers/fixtures';
import { CardOperation, JSONAPIDocument, Format, Saved, CardModel } from '@cardstack/core/src/interfaces';
import { cardURL } from '@cardstack/core/src/utils';
import { configureHubWithCompiler } from '../helpers/cards';
import merge from 'lodash/merge';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers';

function p(dateString: string): Date {
  return parse(dateString, 'yyyy-MM-dd', new Date());
}

let attributes = {
  name: 'Bob Barker',
  birthdate: '1923-12-12',
  address: {
    street: '101 Price is Right ln',
    city: 'Los Angeles',
    state: 'CA',
    settlementDate: '1990-01-01',
  },
};

class StubCards {
  lastOp: CardOperation | undefined;
  async load(_url: string, _format: Format): Promise<CardModel> {
    throw new Error('unimplemented');
  }
  async send(op: CardOperation): Promise<JSONAPIDocument<Saved>> {
    this.lastOp = op;
    return { data: { type: 'cards', id: 'x' } };
  }
  prepareComponent() {}
  tracked(_target: CardModel, _prop: string, desc: PropertyDescriptor) {
    return desc;
  }
}

if (process.env.COMPILER) {
  describe('CardModelForHub', function () {
    let { getContainer, realmURL, cards } = configureHubWithCompiler(this);
    let cardDBResult: Record<string, any>;

    this.beforeEach(async function () {
      let dbManager = await getContainer().lookup('database-manager');
      let db = await dbManager.getClient();

      await cards.create(ADDRESS_RAW_CARD);
      await cards.create(
        merge({}, PERSON_RAW_CARD, {
          files: {
            // make sure to use the birthdate and address fields
            'isolated.js': templateOnlyComponentTemplate(
              `<div class="person-isolated" data-test-person>Hi! I am <@fields.name/><@fields.birthdate/><@fields.address/></div>`,
              { IsolatedStyles: './isolated.css' }
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

      let {
        rows: [result],
      } = await db.query(
        'SELECT url, data, "schemaModule", "componentInfos", "compileErrors", deps from cards where url = $1',
        [`${realmURL}bob-barker`]
      );
      cardDBResult = result;
    });

    it('.data', async function () {
      let model = cards.makeCardModelFromDatabase('isolated', cardDBResult);
      expect(model.data.name).to.equal(attributes.name);
      expect(isSameDay(model.data.birthdate, p('1923-12-12')), 'Dates are serialized to Dates').to.be.ok;
      expect(model.data.address.street).to.equal(attributes.address.street);
      expect(isSameDay(model.data.address.settlementDate, p('1990-01-01')), 'Dates are serialized to Dates').to.be.ok;
    });

    it('.url on new card throws error', async function () {
      let parentCard = await cards.loadData(`${realmURL}person`, 'isolated');
      let model = parentCard.adoptIntoRealm(realmURL);
      try {
        model.url;
        throw new Error('did not throw expected error');
      } catch (e: any) {
        expect(e.message).to.equal(`bug: card in state created does not have a url`);
      }
    });

    it('.save() new card', async function () {
      let parentCard = await cards.loadData(`${realmURL}person`, 'isolated');
      let model = parentCard.adoptIntoRealm(realmURL);
      model.setData({ name: 'Kirito', address: { settlementDate: p('2022-02-22') } });
      expect(model.data.address.settlementDate instanceof Date).to.be.true;
      expect(isSameDay(model.data.address.settlementDate, p('2022-02-22')), 'Dates are serialized to Dates').to.be.ok;
      await model.save();

      let kirito = await cards.loadData(model.url, 'isolated');
      expect(kirito.data.name).to.equal('Kirito');
      expect(kirito.data.address.settlementDate instanceof Date).to.be.true;
      expect(isSameDay(kirito.data.address.settlementDate, p('2022-02-22')), 'Dates are serialized to Dates').to.be.ok;
    });

    // Add this back in after we implement CardModelForHub.save()
    it.skip('.serialize', async function () {
      let stub = new StubCards();
      let model = cards.makeCardModelFromDatabase('isolated', cardDBResult);

      await model.save();
      let op = stub.lastOp;
      if (!op || !('update' in op)) {
        throw new Error(`did not find create operation`);
      }
      expect(op.update.payload, 'A model can be serialized once instantiated').to.deep.equal({
        data: {
          id: cardURL(PERSON_RAW_CARD),
          type: 'card',
          attributes,
        },
      });
    });
  });
}
