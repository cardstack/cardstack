import { module, test } from 'qunit';
import { cardURL } from '@cardstack/core/src/utils';
import { parse, isSameDay } from 'date-fns';

import { PERSON_RAW_CARD } from '@cardstack/core/tests/helpers/fixtures';
import {
  CardOperation,
  JSONAPIDocument,
  Format,
  Saved,
  CardModel,
} from '@cardstack/core/src/interfaces';

function p(dateString: string): Date {
  return parse(dateString, 'yyyy-MM-dd', new Date());
}

const serializerMap = {
  date: ['birthdate', 'address.settlementDate'],
};

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

const fakeComponent: unknown = {};

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

module('@core | card-model-for-browser', function (_hooks) {
  test('.data', async function (assert) {
    let stub = new StubCards();
    let model = this.cardService.makeCardModelFromResponse(
      stub,
      cardJSONResponse.data,
      fakeComponent,
      serializerMap,
      'isolated'
    );
    assert.equal(
      model.data.name,
      attributes.name,
      'name field value is correct'
    );
    assert.ok(
      isSameDay(model.data.birthdate, p('1923-12-12')),
      'Dates are serialized to Dates'
    );
    assert.equal(
      model.data.address.street,
      attributes.address.street,
      'street field value is correct'
    );
    assert.ok(
      isSameDay(model.data.address.settlementDate, p('1990-01-01')),
      'Dates are serialized to Dates'
    );
  });

  test('.serialize', async function (assert) {
    let stub = new StubCards();
    let model = this.cardService.makeCardModelFromResponse(
      stub,
      cardJSONResponse.data,
      fakeComponent,
      serializerMap,
      'isolated'
    );

    await model.save();
    let op = stub.lastOp;
    if (!op || !('update' in op)) {
      throw new Error(`did not find create operation`);
    }
    assert.deepEqual(
      op.update.payload,
      {
        data: {
          id: cardURL(PERSON_RAW_CARD),
          type: 'card',
          attributes,
        },
      },
      'A model can be serialized once instantiated'
    );
  });
});
