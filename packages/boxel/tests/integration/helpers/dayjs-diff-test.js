// https://github.com/stefanpenner/ember-moment/blob/master/tests/unit/helpers/moment-diff-test.js

import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import dayjs from 'dayjs';

module('Integration | Helper | dayjs-diff', function (hooks) {
  setupRenderingTest(hooks);

  test('two args with (dateA, dateB)', async function (assert) {
    this.setProperties({
      dateA: '2017-01-10',
      dateB: '2017-01-15',
    });

    await render(hbs`{{dayjs-diff this.dateA this.dateB}}`);
    assert.equal(this.element.textContent.trim(), '432000000');
  });

  test('two args with a dayjs instance and a string (dayJsInstance, dateString)', async function (assert) {
    this.setProperties({
      dayJsInstance: dayjs('2017-01-10'),
      dateString: '2017-01-15',
    });

    await render(hbs`{{dayjs-diff this.dayJsInstance this.dateString}}`);
    assert.equal(this.element.textContent.trim(), '432000000');
  });

  test('two args with (dateA, dateB) and expect a negative result', async function (assert) {
    this.setProperties({
      dateA: '2017-01-15',
      dateB: '2017-01-10',
    });

    await render(hbs`{{dayjs-diff this.dateA this.dateB}}`);
    assert.equal(this.element.textContent.trim(), '-432000000');
  });

  test('two args with precision (dateA, dateB, precision)', async function (assert) {
    this.setProperties({
      dateA: new Date(0),
      dateB: dayjs(0).add(5, 'day'),
    });

    await render(hbs`{{dayjs-diff this.dateA this.dateB precision="day"}}`);
    assert.equal(this.element.textContent.trim(), '5');
  });

  // this test is not very consistent - the floating number has javascript floating point issues
  test('two args with precision and float (dateA, dateB, precision, float)', async function (assert) {
    this.setProperties({
      dateA: new Date(0),
      dateB: dayjs(0).add(6, 'month'),
    });

    await render(
      hbs`{{dayjs-diff this.dateA this.dateB precision="year" float=true}}`
    );
    assert.equal(this.element.textContent.trim(), '0.5');
  });
});
