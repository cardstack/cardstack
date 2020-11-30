import { module, test } from 'qunit';
import { visit } from '@ember/test-helpers';
import { setupApplicationTest } from 'ember-qunit';
import Fixtures from '../helpers/fixtures';
import { waitForCardLoad, waitForTestsToEnd } from '../helpers/card-ui-helpers';
import { login } from '../helpers/login';
import { cardDocument, CARDSTACK_PUBLIC_REALM } from '@cardstack/hub';

const csRealm = `http://localhost:3000/api/realms/default`;
const plusOne = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'plus-one',
    csFeatures: { compute: 'compute.js' },
    csFiles: {
      'compute.js': `export default async function() { return { value: 1 + 1 }; }`,
    },
  })
  .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'integer-field' });

const plusPlusOne = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'plus-one',
    csFeatures: { compute: 'compute.js' },
    csFiles: {
      'compute.js': `export default async function({ field, card }) {
        let otherFieldName = await field.value('otherFieldName');
        let otherFieldValue = await card.value(otherFieldName);
        return { value: otherFieldValue + 1 };
      }
      `,
    },
  })
  .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'integer-field' });

const count = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'count-card',
    csFieldSets: {
      isolated: ['count'],
    },
  })
  .withField('count', plusOne, 'singular', { csTitle: 'Count' })
  .withField('age', 'integer-field', 'singular', { csTitle: 'Age' })
  .withField('agePlusOne', plusPlusOne, 'singular', { csTitle: 'Age Plus One', otherFieldName: 'age' });

const age = cardDocument()
  .withAttributes({
    csRealm,
    csId: 'age-card',
    csFieldSets: {
      isolated: ['count', 'age', 'agePlusOne'],
    },
  })
  .adoptingFrom(count)
  .withAttributes({ age: 5 });

const scenario = new Fixtures({
  create: [plusOne, count, plusPlusOne, age],
});

module('Acceptance | computed fields', function(hooks) {
  setupApplicationTest(hooks);
  scenario.setupModule(hooks);

  hooks.beforeEach(async function() {
    await login();
  });
  hooks.afterEach(async function() {
    await waitForTestsToEnd();
  });

  test(`viewing card`, async function(assert) {
    await visit(`/cards/${encodeURIComponent(count.canonicalURL)}`);
    await waitForCardLoad();

    assert.dom('[data-test-integer-field-viewer-label]').hasText('Count');
    assert.dom('[data-test-integer-field-viewer-value]').hasText('2');
  });

  test(`viewing adopted card`, async function(assert) {
    await visit(`/cards/${encodeURIComponent(age.canonicalURL)}`);
    await waitForCardLoad();

    assert.dom('.count-label').hasText('Count');
    assert.dom('.count-value').hasText('2');
    assert.dom('.age-label').hasText('Age');
    assert.dom('.age-value').hasText('5');
    assert.dom('.agePlusOne-label').hasText('Age Plus One');
    assert.dom('.agePlusOne-value').hasText('6');
  });
});
