// https://github.com/stefanpenner/ember-moment/blob/master/tests/unit/helpers/moment-format-test.js

import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import dayjs from 'dayjs';

const date = dayjs;

module('Integration | Helper | dayjs-format', function (hooks) {
  setupRenderingTest(hooks);

  test('one arg (date)', async function (assert) {
    this.set('date', '2020-01-02');
    await render(hbs`{{dayjs-format this.date}}`);
    assert.equal(this.element.textContent.trim(), '2 January, 2020');
  });

  test('two args (date, inputFormat)', async function (assert) {
    this.setProperties({
      format: 'MMMM D, YYYY',
      date: dayjs(new Date(2011, 9, 10)),
    });

    await render(hbs`{{dayjs-format this.date this.format}}`);
    assert.equal(this.element.textContent.trim(), 'October 10, 2011');
  });

  test('three args (date, outputFormat, inputFormat)', async function (assert) {
    this.setProperties({
      inputFormat: 'M/D/YY',
      outputFormat: 'MMMM D, YYYY',
      date: '5/3/10',
    });

    await render(
      hbs`{{dayjs-format this.date this.outputFormat this.inputFormat}}`
    );
    assert.equal(this.element.textContent.trim(), 'May 3, 2010');
  });

  test('works with change in input', async function (assert) {
    this.set('date', '2020-01-02');

    await render(hbs`{{dayjs-format this.date}}`);
    assert.equal(this.element.textContent.trim(), '2 January, 2020');

    this.set('date', date('5/3/10'));
    assert.equal(this.element.textContent.trim(), '3 May, 2010');
  });
});
