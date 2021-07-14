import { parse, isSameDay } from 'date-fns';

function p(dateString: string): Date {
  return parse(dateString, 'yyyy-MM-dd', new Date());
}

import { CompiledCard } from '@cardstack/core/src/interfaces';
import {
  ADDRESS_RAW_CARD,
  PERSON_RAW_CARD,
} from '@cardstack/core/tests/helpers/fixtures';
import QUnit from 'qunit';

const { module: Qmodule, test } = QUnit;

import CardModel from '@cardstack/core/src/card-model';
import { TestBuilder } from '../helpers/test-builder';

export class PersonCardModel extends CardModel {
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

Qmodule('CardModel', function () {
  test('.data', async function (assert) {
    let model = new PersonCardModel(cardJSONResponse);
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
    let model = new PersonCardModel(cardJSONResponse);
    model.data; // lazy deserializing
    let serialized = model.serialize();
    assert.deepEqual(
      serialized,
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

  Qmodule('Static methods', async function (hooks) {
    let builder: TestBuilder;
    let personCard: CompiledCard;

    hooks.beforeEach(async () => {
      builder = new TestBuilder();
      builder.addRawCard(ADDRESS_RAW_CARD);
      builder.addRawCard(
        Object.assign(
          {
            data: attributes,
          },
          PERSON_RAW_CARD
        )
      );
      personCard = await builder.getCompiledCard(PERSON_RAW_CARD.url);
    });

    test('#serialize', async function (assert) {
      let serialized = PersonCardModel.serialize(personCard, 'isolated');
      assert.deepEqual(serialized, {
        data: {
          id: PERSON_RAW_CARD.url,
          type: 'card',
          attributes,
          meta: {
            componentModule: personCard.isolated.moduleName,
          },
        },
      });
    });
  });
});
