import { parse, isSameDay } from 'date-fns';

function p(dateString: string): Date {
  return parse(dateString, 'yyyy-MM-dd', new Date());
}

import { PERSON_RAW_CARD } from '@cardstack/core/tests/helpers/fixtures';
import QUnit from 'qunit';

const { module: Qmodule, test } = QUnit;

import CardModel from 'cardhost/lib/card-model';
import { CardJSONResponse, Format } from '@cardstack/core/src/interfaces';

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
    id: PERSON_RAW_CARD.url,
    type: 'card',
    attributes,
    meta: {
      componentModule: '',
    },
  },
};

class StubCards {
  lastBody: any;
  async load(_url: string, _format: Format): Promise<CardModel> {
    throw new Error('unimplemented');
  }
  buildNewURL(_realm: string, _parentCardURL: string): string {
    throw new Error('unimplemented');
  }
  buildCardURL(_url: string, _format?: Format): string {
    throw new Error('unimplemented');
  }
  async fetchJSON(_url: string, _options: any = {}): Promise<CardJSONResponse> {
    throw new Error('unimplemented');
  }
}
const fakeComponent: unknown = {};

Qmodule('CardModel', function () {
  test('.data', async function (assert) {
    let stub = new StubCards();
    let model = PersonCardModel.newFromResponse(
      stub,
      cardJSONResponse,
      fakeComponent
    );
    assert.equal(model.data.name, attributes.name);
    assert.ok(
      isSameDay(model.data.birthdate, p('1923-12-12')),
      'Dates are serialized to Dates'
    );
    assert.equal(model.data.address.street, attributes.address.street);
    assert.ok(
      isSameDay(model.data.address.settlementDate, p('1990-01-01')),
      'Dates are serialized to Dates'
    );
  });

  test('.serialize', async function (assert) {
    let stub = new StubCards();
    let model = PersonCardModel.newFromResponse(
      stub,
      cardJSONResponse,
      fakeComponent
    );

    await model.save();
    assert.deepEqual(
      stub.lastBody,
      {
        data: {
          id: PERSON_RAW_CARD.url,
          type: 'card',
          attributes,
        },
      },
      'A model can be serialized once instantiated'
    );
  });
});
