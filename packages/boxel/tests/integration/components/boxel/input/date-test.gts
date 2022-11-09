import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, resetOnerror } from '@ember/test-helpers';
import BoxelInputDate, { Day } from '@cardstack/boxel/components/boxel/input/date';
import a11yAudit from 'ember-a11y-testing/test-support/audit';
import { tracked } from '@glimmer/tracking';

const TRIGGER_SELECTOR = '[data-test-boxel-input-date-trigger]';

class Bindings {
  @tracked value: Day | undefined;
}
let bindings: Bindings;

function dayChanged(newValue: Day) {
  bindings.value = newValue;
}

module('Integration | Component | InputDate', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    bindings = new Bindings();
  });
  hooks.afterEach(function () {
    resetOnerror();
  });

  test('Accessibility Check', async function (assert) {
    bindings.value = new Date();

    await render(<template>
      <BoxelInputDate @value={{bindings.value}} @onChange={{dayChanged}} />
    </template>);

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('@value is rendered', async function (assert) {
    bindings.value = new Date(2022, 11, 3);

    await render(<template>
      <BoxelInputDate
        @value={{bindings.value}}
        @onChange={{dayChanged}}
      />
    </template>);

    assert.dom(TRIGGER_SELECTOR).containsText('12/3/2022');
  });

  test('@onChange receives the updated value', async function (assert) {
    bindings.value = new Date(2022, 11, 3);

    await render(<template>
      <BoxelInputDate
        @value={{bindings.value}}
        @onChange={{dayChanged}}
      />
    </template>);

    await click(TRIGGER_SELECTOR);

    await click('[data-date="2022-12-25"]');
    assert.dom(TRIGGER_SELECTOR).containsText('12/25/2022');

    await click('[data-date="2022-12-28"]');
    assert.dom(TRIGGER_SELECTOR).containsText('12/28/2022');

    assert.equal(bindings.value.getMonth(), 11);
    assert.equal(bindings.value.getDate(), 28);
    assert.equal(bindings.value.getFullYear(), 2022);

    await click('.ember-power-calendar-nav-control--next');
    await click('[data-date="2023-01-15"]');
    assert.dom(TRIGGER_SELECTOR).containsText('1/15/2023');
  });
});
