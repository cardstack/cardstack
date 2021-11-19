import { module, test } from 'qunit';
import hbs from 'htmlbars-inline-precompile';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { cssUrl } from '@cardstack/boxel/helpers/css-url';

module('Integration | Helper | css-url', function (hooks) {
  setupRenderingTest(hooks);

  test('it renders', async function (assert) {
    this.set('avatar', '/picture.png');
    await render(
      hbs`<div class="example" style={{css-url "background-image" this.avatar}}></div>`
    );

    let style = this.element.querySelector('.example')?.getAttribute('style');
    assert.equal(style, `background-image: url("/picture.png")`);
  });

  test('it rejects any funny protocols', async function (assert) {
    assert.throws(() => {
      cssUrl('background-image', 'weird://foo');
    }, /disallowed protocol/);
  });

  test('it encodes any quotes', function (assert) {
    assert.equal(
      cssUrl('background-image', 'foo"bar')?.toString(),
      'background-image: url("foo%22bar")'
    );
  });

  test("it doesn't double-encode URLs that already have encoding", function (assert) {
    assert.equal(
      cssUrl('background-image', '/?title=I%20%22Think%22%20So')?.toString(),
      'background-image: url("/?title=I%20%22Think%22%20So")'
    );
  });
});
