import { module, test, skip } from 'qunit';
import { parse, isSameDay } from 'date-fns';
import { setupCardTest } from '../helpers/setup';
import { lookup } from '../helpers/lookup';
import { templateOnlyComponentTemplate } from '@cardstack/core/tests/helpers/templates';

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
    zip: '11111',
  },
};

module('@core | card-model-for-browser', function (hooks) {
  let { createCard, localRealmURL } = setupCardTest(hooks);

  hooks.beforeEach(async function () {
    await createCard({
      realm: localRealmURL,
      id: 'address',
      schema: 'schema.js',
      embedded: 'embedded.js',
      files: {
        'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          import date from "https://cardstack.com/base/date";

          export default class Address {
            @contains(string) street;
            @contains(string) city;
            @contains(string) state;
            @contains(string) zip;
            @contains(date) settlementDate;
          }
        `,
        'embedded.js': templateOnlyComponentTemplate(
          `<p><@fields.street /><br /> <@fields.city />, <@fields.state /> <@fields.zip /></p><p>Moved In: <@fields.settlementDate /></p>`
        ),
      },
    });

    await createCard({
      realm: localRealmURL,
      id: 'person',
      schema: 'schema.js',
      embedded: 'embedded.js',
      files: {
        'schema.js': `
          import { contains } from "@cardstack/types";
          import string from "https://cardstack.com/base/string";
          import date from "https://cardstack.com/base/date";
          import address from "https://cardstack.local/address";

          export default class Person {
            @contains(string) name;
            @contains(date) birthdate;
            @contains(address) address;
          }
        `,
        'embedded.js': templateOnlyComponentTemplate(`<@fields.name />`),
      },
    });

    await createCard({
      id: 'bob',
      realm: localRealmURL,
      adoptsFrom: `${localRealmURL}person`,
      data: attributes,
    });
  });

  test('.data', async function (assert) {
    let model = await lookup(this, 'cards').loadModel(
      `${localRealmURL}bob`,
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
      'Nested card Dates are serialized to Dates'
    );
  });

  skip('unused fields are not present', async function (assert) {
    let model = await lookup(this, 'cards').loadModel(
      `${localRealmURL}bob`,
      'embedded'
    );
    assert.equal(
      model.data.name,
      attributes.name,
      'name field value is correct'
    );
    assert.equal(
      model.data.birthdate,
      undefined,
      'birthdate field should be missing'
    );
  });

  test('.serialize', async function (assert) {
    let model = await lookup(this, 'cards').loadModel(
      `${localRealmURL}bob`,
      'isolated'
    );
    let payload = await model.serialize();
    assert.deepEqual(
      payload as any,
      {
        id: `${localRealmURL}bob`,
        type: 'card',
        attributes,
      },
      'A model can be serialized once instantiated'
    );
  });
});
