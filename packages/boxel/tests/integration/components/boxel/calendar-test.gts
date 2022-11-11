import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, resetOnerror } from '@ember/test-helpers';
import BoxelCalendar, { Day } from '@cardstack/boxel/components/boxel/calendar';
import a11yAudit from 'ember-a11y-testing/test-support/audit';
import { tracked } from '@glimmer/tracking';

const COMPONENT_SELECTOR = '[data-test-boxel-calendar]';

class Bindings {
  @tracked selected: Day | undefined;
}
let bindings: Bindings;

function onSelect(newValue: Day) {
  bindings.selected = newValue;
}

module('Integration | Component | Calendar', function (hooks) {
  setupRenderingTest(hooks);

  hooks.beforeEach(function () {
    bindings = new Bindings();
  });
  hooks.afterEach(function () {
    resetOnerror();
  });

  test('Accessibility Check', async function (assert) {
    bindings.selected = new Date(2023, 11, 5);
    await render(<template>
      <BoxelCalendar
        @selected={{bindings.selected}}
        @onSelect={{onSelect}}
      />
    </template>);
    assert.dom(COMPONENT_SELECTOR).containsText('December 2023');

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('@selected is rendered', async function (assert) {
    bindings.selected = new Date(2022, 2, 3, 13, 45);

    await render(<template>
      <BoxelCalendar
        @selected={{bindings.selected}}
        @onSelect={{onSelect}}
      />
    </template>);

    let selectedEl = document.querySelector(`${COMPONENT_SELECTOR} .ember-power-calendar-day--selected`);
    assert.dom(selectedEl).hasAttribute('data-date', '2022-03-03');
  });

  test('clicking a date selects it', async function (assert) {
    bindings.selected = new Date(2022, 2, 3, 13, 45);

    await render(<template>
      <BoxelCalendar
        @selected={{bindings.selected}}
        @onSelect={{onSelect}}
      />
    </template>);

    await click('[data-date="2022-03-12"]')

    let selectedEl = document.querySelector(`${COMPONENT_SELECTOR} .ember-power-calendar-day--selected`);
    assert.dom(selectedEl).hasAttribute('data-date', '2022-03-12');
    assert.equal(bindings.selected.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }), new Date(2022, 2, 12).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }));
  });
});
