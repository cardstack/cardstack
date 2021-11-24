import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { hbs } from 'ember-cli-htmlbars';
import { fillIn, click } from '@ember/test-helpers';
// import a11yAudit from 'ember-a11y-testing/test-support/audit';

const ITEM = '[data-test-boxel-contains-many-manager-item]';

module('Integration | Component | ContainsManyManager', function (hooks) {
  setupRenderingTest(hooks);

  // hooks.afterEach(async function (assert) {
  //   await a11yAudit();
  //   assert.ok(true, 'no a11y errors found!');
  // });

  test('it can manage contained items', async function (assert) {
    let links = ['Twitter', 'LinkedIn'];
    this.set('links', links);
    this.set('setter', (payload) => {
      this.links = payload;
    });

    await render(
      hbs`<Boxel::ContainsManyManager @model={{this.links}} @set={{this.setter}} as |api|>
        <Boxel::Input @value={{api.item}} @onInput={{api.onUpdate}} />
      </Boxel::ContainsManyManager>`
    );

    assert.dom('[data-test-boxel-contains-many-manager]').exists();
    assert.dom(ITEM).exists({ count: 2 });
    assert.dom(`${ITEM}:nth-of-type(1) input`).hasValue('Twitter');

    await fillIn(`${ITEM}:nth-of-type(1) input`, 'Facebook');
    assert.deepEqual(this.links, ['Facebook', 'LinkedIn']);

    await click('[data-test-boxel-contains-many-manager-add-button]');

    assert.dom(ITEM).exists({ count: 3 });
    assert.dom(`${ITEM}:nth-of-type(3) input`).hasValue('');

    await fillIn(`${ITEM}:last-of-type input`, 'Pinterest');
    assert.deepEqual(this.links, ['Facebook', 'LinkedIn', 'Pinterest']);

    await click('[data-test-boxel-contains-many-manager-remove-button="1"]');
    assert.deepEqual(this.links, ['Facebook', 'Pinterest']);
  });
});
