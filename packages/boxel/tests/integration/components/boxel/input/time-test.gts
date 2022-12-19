import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { click, render, resetOnerror, settled, setupOnerror } from '@ember/test-helpers';
import BoxelInputTime, { Time } from '@cardstack/boxel/components/boxel/input/time';
import a11yAudit from 'ember-a11y-testing/test-support/audit';
import { tracked } from '@glimmer/tracking';
import { keyDown } from 'ember-keyboard/test-support/test-helpers';
import { delay } from '../../../../helpers';

const TRIGGER_SELECTOR = '[data-test-boxel-input-time-trigger]';

class Bindings {
  @tracked value: Time | undefined;
  @tracked minValue: Time | undefined;
}
let bindings: Bindings;

function timeChanged(newValue: Time) {
  bindings.value = newValue;
}

module('Integration | Component | InputTime', function (hooks) {
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
      <BoxelInputTime @value={{bindings.value}} />
    </template>);

    await a11yAudit();
    assert.ok(true, 'no a11y errors found!');
  });

  test('@value is rendered', async function (assert) {
    bindings.value = new Date(2022, 2, 3, 13, 45);

    await render(<template>
      <BoxelInputTime
        @value={{bindings.value}}
      />
    </template>);

    assert.dom(TRIGGER_SELECTOR).containsText('1:45 PM');
  });

  test('@onChange receives the updated value', async function (assert) {
    bindings.value = new Date(2022, 2, 3, 13, 45);

    await render(<template>
      <BoxelInputTime
        @value={{bindings.value}}
        @onChange={{timeChanged}}
      />
    </template>);

    await click(TRIGGER_SELECTOR);

    await click('[data-test-boxel-menu-item-text="12"]');
    assert.dom(TRIGGER_SELECTOR).containsText('12:45 PM');

    await click('[data-test-boxel-menu-item-text="05"]');
    assert.dom(TRIGGER_SELECTOR).containsText('12:05 PM');

    await click('[data-test-boxel-menu-item-text="am"]');
    assert.dom(TRIGGER_SELECTOR).containsText('12:05 AM');

    assert.equal(bindings.value.getHours(), 0);
    assert.equal(bindings.value.getMinutes(), 5);
  });

  test('the correct items are selected in the dropdowns', async function (assert) {
    bindings.value = new Date(2022, 2, 3, 6, 45);

    await render(<template>
      <BoxelInputTime @value={{bindings.value}} />
    </template>);

    await click(TRIGGER_SELECTOR);

    assert.dom('.boxel-menu__item--selected [data-test-boxel-menu-item-text="6"]').exists();
    assert.dom('.boxel-menu__item--selected [data-test-boxel-menu-item-text="45"]').exists();
    assert.dom('.boxel-menu__item--selected [data-test-boxel-menu-item-text="am"]').exists();

    bindings.value = new Date(2022, 2, 3, 13, 45);
    await settled();

    assert.dom('.boxel-menu__item--selected [data-test-boxel-menu-item-text="1"]').exists();
    assert.dom('.boxel-menu__item--selected [data-test-boxel-menu-item-text="45"]').exists();
    assert.dom('.boxel-menu__item--selected [data-test-boxel-menu-item-text="pm"]').exists();
  });

  test('minuteInterval with 15', async function (assert) {
    bindings.value = new Date(2022, 2, 3, 6, 45);

    await render(<template>
      <BoxelInputTime @value={{bindings.value}} @minuteInterval={{15}} />
    </template>);

    await click(TRIGGER_SELECTOR);

    assert.dom('[data-test-boxel-minute-menu] [data-test-boxel-menu-item-text]').exists({ count: 4 });
    assert.dom('[data-test-boxel-minute-menu] [data-test-boxel-menu-item-text="00"]').exists();
    assert.dom('[data-test-boxel-minute-menu] [data-test-boxel-menu-item-text="15"]').exists();
    assert.dom('[data-test-boxel-minute-menu] [data-test-boxel-menu-item-text="30"]').exists();
    assert.dom('[data-test-boxel-minute-menu] [data-test-boxel-menu-item-text="45"]').exists();
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="45"]').exists();
  });

  test('minuteInterval with 20', async function (assert) {
    bindings.value = new Date(2022, 2, 3, 6, 45);

    await render(<template>
      <BoxelInputTime @value={{bindings.value}} @minuteInterval={{20}} />
    </template>);

    await click(TRIGGER_SELECTOR);

    assert.dom('[data-test-boxel-minute-menu] [data-test-boxel-menu-item-text]').exists({ count: 3 });
    assert.dom('[data-test-boxel-minute-menu] [data-test-boxel-menu-item-text="00"]').exists();
    assert.dom('[data-test-boxel-minute-menu] [data-test-boxel-menu-item-text="20"]').exists();
    assert.dom('[data-test-boxel-minute-menu] [data-test-boxel-menu-item-text="40"]').exists();
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--selected').doesNotExist();
  });

  test('minuteInterval with 8 -- does not work', async function (assert) {
    bindings.value = new Date(2022, 2, 3, 6, 45);

    setupOnerror(function(err: Error) {
      assert.equal(err.message, "@minuteInterval passed to Boxel::Input::Time must be a factor of 60 but was 8");
    });

    await render(<template>
      <BoxelInputTime @value={{bindings.value}} @minuteInterval={{8}} />
    </template>);
  });

  test('entry via arrow keys', async function (assert) {
    bindings.value = new Date(2022, 2, 3, 6, 45);

    await render(<template>
      <BoxelInputTime @value={{bindings.value}} @onChange={{timeChanged}} />
    </template>);

    assert.dom(TRIGGER_SELECTOR).containsText('6:45 AM');

    await click(TRIGGER_SELECTOR);

    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="6"]').exists();
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="45"]').exists();
    assert.dom('[data-test-boxel-meridian-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="am"]').exists();

    await keyDown('ArrowDown');
    assert.dom(TRIGGER_SELECTOR).containsText('7:45 AM');
    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="7"]').exists();
    assert.dom('[data-test-boxel-hour-menu]').isFocused();

    await keyDown('ArrowUp');
    await keyDown('ArrowUp');
    assert.dom(TRIGGER_SELECTOR).containsText('5:45 AM');
    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="5"]').exists();
    assert.dom('[data-test-boxel-hour-menu]').isFocused();
    
    await keyDown('ArrowRight');
    assert.dom('[data-test-boxel-minute-menu]').isFocused();
    await keyDown('ArrowDown');
    assert.dom(TRIGGER_SELECTOR).containsText('5:50 AM');
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="50"]').exists();
    
    await keyDown('ArrowRight');
    assert.dom('[data-test-boxel-meridian-menu]').isFocused();
    await keyDown('ArrowDown');
    assert.dom(TRIGGER_SELECTOR).containsText('5:50 PM');
    assert.dom('[data-test-boxel-meridian-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="pm"]').exists();
    
    await keyDown('ArrowRight');
    assert.dom('[data-test-boxel-meridian-menu]').isFocused();
});

  test('entry via number keys and a/p, Enter to dismiss', async function (assert) {
    bindings.value = new Date(2022, 2, 3, 6, 45);

    await render(<template>
      <BoxelInputTime @value={{bindings.value}} @onChange={{timeChanged}} />
    </template>);

    assert.dom(TRIGGER_SELECTOR).containsText('6:45 AM');

    await click(TRIGGER_SELECTOR);

    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="6"]').exists();
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="45"]').exists();
    assert.dom('[data-test-boxel-meridian-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="am"]').exists();

    keyDown('Digit1');
    await delay(100);
    keyDown('Digit2');
    await delay(100);
    keyDown('shift+Semicolon');
    await delay(100);
    keyDown('Digit0');
    await delay(100);
    keyDown('Digit5');
    await delay(100);
    keyDown('KeyP');
    await delay(100);
    
    assert.dom(TRIGGER_SELECTOR).containsText('12:05 PM');
    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="12"]').exists();
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="05"]').exists();
    assert.dom('[data-test-boxel-meridian-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="pm"]').exists();
    assert.dom('[data-test-boxel-meridian-menu]').isFocused();

    await keyDown('Enter');
    assert.dom('[data-test-boxel-hour-menu]').doesNotExist();
    assert.dom('[data-test-boxel-minute-menu]').doesNotExist();
    assert.dom('[data-test-boxel-meridian-menu]').doesNotExist();
    assert.dom(TRIGGER_SELECTOR).isFocused();
  });

  test('disables hours before minValue hour', async function (assert) {
    bindings.value = new Date(2022, 2, 3, 10, 0);
    bindings.minValue = new Date(2022, 2, 3, 9, 0);

    await render(<template>
      <BoxelInputTime @value={{bindings.value}} @minValue={{bindings.minValue}} @onChange={{timeChanged}} />
    </template>);
    

    assert.dom(TRIGGER_SELECTOR).containsText('10:00 AM');
    await click(TRIGGER_SELECTOR);

    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="10"]').exists();
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="00"]').exists();
    assert.dom('[data-test-boxel-meridian-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="am"]').exists();

    //Hours before 9 is disabled
    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--disabled [data-test-boxel-menu-item-text="8"]').exists();
    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--disabled [data-test-boxel-menu-item-text="7"]').exists();
    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--disabled [data-test-boxel-menu-item-text="6"]').exists();

    //Click disabled hour will not update value
    await click('[data-test-boxel-menu-item-text="6"]');
    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="10"]').exists();
  });

  test('disables minutes before minValue minute', async function (assert) {
    bindings.value = new Date(2022, 2, 3, 9, 40);
    bindings.minValue = new Date(2022, 2, 3, 9, 30);

    await render(<template>
      <BoxelInputTime @value={{bindings.value}} @minValue={{bindings.minValue}} @onChange={{timeChanged}} />
    </template>);
    

    assert.dom(TRIGGER_SELECTOR).containsText('9:40 AM');
    await click(TRIGGER_SELECTOR);

    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="9"]').exists();
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="40"]').exists();
    assert.dom('[data-test-boxel-meridian-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="am"]').exists();

    //Minutes before 30 is disabled
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--disabled [data-test-boxel-menu-item-text="25"]').exists();
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--disabled [data-test-boxel-menu-item-text="20"]').exists();
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--disabled [data-test-boxel-menu-item-text="15"]').exists();

    //Click disabled minute will not update value
    await click('[data-test-boxel-menu-item-text="25"]');
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="40"]').exists();
  });

  test('disables meridian AM if minValue more than 11:59 AM', async function (assert) {
    bindings.value = new Date(2022, 2, 3, 13, 0);
    bindings.minValue = new Date(2022, 2, 3, 12, 0);

    await render(<template>
      <BoxelInputTime @value={{bindings.value}} @minValue={{bindings.minValue}} @onChange={{timeChanged}} />
    </template>);
    

    assert.dom(TRIGGER_SELECTOR).containsText('1:00 PM');
    await click(TRIGGER_SELECTOR);

    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="1"]').exists();
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="00"]').exists();
    assert.dom('[data-test-boxel-meridian-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="pm"]').exists();

    //AM is disabled
    assert.dom('[data-test-boxel-meridian-menu] .boxel-menu__item--disabled [data-test-boxel-menu-item-text="am"]').exists();

    await click('[data-test-boxel-menu-item-text="am"]');
    assert.dom('[data-test-boxel-meridian-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="pm"]').exists();
  });

  test('if meridian update to AM and results value lower than minValue, then value will be equal with minValue', async function (assert) {
    bindings.value = new Date(2022, 2, 3, 13, 0);
    bindings.minValue = new Date(2022, 2, 3, 9, 0);

    await render(<template>
      <BoxelInputTime @value={{bindings.value}} @minValue={{bindings.minValue}} @onChange={{timeChanged}} />
    </template>);
    

    assert.dom(TRIGGER_SELECTOR).containsText('1:00 PM');
    await click(TRIGGER_SELECTOR);

    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="1"]').exists();
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="00"]').exists();
    assert.dom('[data-test-boxel-meridian-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="pm"]').exists();

    //Update meridian to AM
    //value will be equal with minValue
    //Because 01:00 AM is lower than minValue 09:00 AM
    await click('[data-test-boxel-menu-item-text="am"]');
    assert.dom('[data-test-boxel-hour-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="9"]').exists();
    assert.dom('[data-test-boxel-minute-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="00"]').exists();
    assert.dom('[data-test-boxel-meridian-menu] .boxel-menu__item--selected [data-test-boxel-menu-item-text="am"]').exists();
  });
});
