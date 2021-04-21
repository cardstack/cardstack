// https://github.com/stefanpenner/ember-moment/blob/master/tests/unit/helpers/moment-from-test.js

import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import dayjs from 'dayjs';

module('Integration | Helper | dayjs-from', function (hooks) {
  setupRenderingTest(hooks);

  test('one arg (date)', async function (assert) {
    this.set('date', dayjs().add(3, 'day'));

    await render(hbs`{{dayjs-from this.date}}`);
    assert.equal(this.element.textContent.trim(), 'in 3 days');
  });

  test('two args (dateA, dateB)', async function (assert) {
    this.setProperties({
      dateA: new Date(0),
      dateB: dayjs(0).add(3, 'day'),
    });

    await render(hbs`{{dayjs-from this.dateB this.dateA}}`);
    assert.equal(this.element.textContent.trim(), 'in 3 days');
  });

  test('two args (dateA, dateB, withoutSuffix=boolean)', async function (assert) {
    this.setProperties({
      dateA: new Date(0),
      dateB: dayjs(0).add(3, 'day'),
    });

    await render(hbs`{{dayjs-from this.dateB this.dateA withoutSuffix=true}}`);
    assert.equal(this.element.textContent.trim(), '3 days');
    await render(hbs`{{dayjs-from this.dateB this.dateA withoutSuffix=false}}`);
    assert.equal(this.element.textContent.trim(), 'in 3 days');
  });

  test('three args (dateA, dateB, boolean)', async function (assert) {
    this.setProperties({
      dateA: new Date(259200000) /* 3 days */,
      dateB: dayjs(259200000).subtract(3, 'day'),
    });

    await render(hbs`{{dayjs-from this.dateA this.dateB true}}`);
    assert.equal(this.element.textContent.trim(), '3 days');
  });
});
