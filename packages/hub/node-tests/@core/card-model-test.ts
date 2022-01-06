// eslint-disable-next-line node/no-extraneous-import
import { parse, isSameDay } from 'date-fns';
import { expect } from 'chai';

import { PERSON_RAW_CARD } from '@cardstack/core/tests/helpers/fixtures';
import CardModel from '@cardstack/core/src/card-model';
import { CardOperation, JSONAPIDocument, Format, Saved } from '@cardstack/core/src/interfaces';
import { cardURL } from '@cardstack/core/src/utils';

function p(dateString: string): Date {
  return parse(dateString, 'yyyy-MM-dd', new Date());
}

class PersonCardModel extends CardModel {
  static serializerMap = {
    date: ['birthdate', 'address.settlementDate'],
  };
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

let cardJSONResponse = {
  data: {
    id: cardURL(PERSON_RAW_CARD),
    type: 'card',
    attributes,
    meta: {
      componentModule: '',
    },
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
const fakeComponent: unknown = {};

if (process.env.COMPILER) {
  describe('CardModel', function () {
    it('.data', async function () {
      let stub = new StubCards();
      let model = PersonCardModel.fromResponse(stub, cardJSONResponse.data, fakeComponent);
      expect(model.data.name).to.equal(attributes.name);
      expect(isSameDay(model.data.birthdate, p('1923-12-12')), 'Dates are serialized to Dates').to.be.ok;
      expect(model.data.address.street).to.equal(attributes.address.street);
      expect(isSameDay(model.data.address.settlementDate, p('1990-01-01')), 'Dates are serialized to Dates').to.be.ok;
    });

    it('.serialize', async function () {
      let stub = new StubCards();
      let model = PersonCardModel.fromResponse(stub, cardJSONResponse.data, fakeComponent);

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
