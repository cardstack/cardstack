import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, click } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';

module('Integration | Modifier | click-outside', function(hooks) {
  setupRenderingTest(hooks);

  test('clicking outside triggers the method call', async function(assert) {
    assert.expect(2); // expect 2 because there's both click and focus events fire for buttons
    this.someMethod = () => {
      assert.ok(true, 'click outside method was called');
    };
    await render(hbs`<div {{click-outside this.someMethod}}></div> <button></button>`);
    await click('button');
  });

  test('clicking ignored element does not trigger method call', async function(assert) {
    assert.expect(0);
    this.someMethod = () => {
      assert.ok(true, 'click outside method was called');
    };
    await render(
      hbs`<div {{click-outside this.someMethod ignore=".ignore-me"}}></div> <button class="ignore-me"></button>`
    );
    await click('button');
  });

  test('clicking non-ignored element triggers method call', async function(assert) {
    assert.expect(2);
    this.someMethod = () => {
      assert.ok(true, 'click outside method was called');
    };
    await render(
      hbs`<div {{click-outside this.someMethod ignore=".ignore-me"}}></div> <button class="ignore-me"></button><button class="do-not-ignore"></button>`
    );
    await click('.do-not-ignore');
  });
});

/*

import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import Component from '@ember/component';

module('Integration | Modifier | did-insert', function(hooks) {
  setupRenderingTest(hooks);

  test('it basically works', async function(assert) {
    assert.expect(2);

    this.someMethod = element => {
      assert.equal(element.tagName, 'DIV', 'correct element tagName');
      assert.dom(element).hasAttribute('data-foo', 'some-thing');
    };
    await render(hbs`<div data-foo="some-thing" {{did-insert this.someMethod}}></div>`);
  });

  test('it can accept arguments', async function(assert) {
    assert.expect(4);

    this.someMethod = (element, positional, named) => {
      assert.equal(element.tagName, 'DIV', 'correct element tagName');
      assert.dom(element).hasAttribute('data-foo', 'some-thing');

      assert.namedArgsEqual(named, { some: 'hash-value' }, 'named args match');
      assert.deepEqual(positional, ['some-positional-value'], 'positional args match');
    };

    await render(
      hbs`<div data-foo="some-thing" {{did-insert this.someMethod "some-positional-value" some="hash-value"}}></div>`
    );
  });

  test('it is not invoked again when arguments change', async function(assert) {
    assert.expect(4);

    this.someMethod = (element, positional, named) => {
      assert.equal(element.tagName, 'DIV', 'correct element tagName');
      assert.dom(element).hasAttribute('data-foo', 'some-thing');

      assert.namedArgsEqual(named, {}, 'named args match');
      assert.deepEqual(positional, ['initial'], 'positional args match');
    };

    this.set('firstArg', 'initial');
    await render(
      hbs`<div data-foo="some-thing" {{did-insert this.someMethod this.firstArg}}></div>`
    );
    this.set('firstArg', 'updated');
  });

  test('adding class on insert (RFC example)', async function(assert) {
    this.owner.register(
      'component:sometimes-fades-in',
      Component.extend({
        fadeIn(element) {
          element.classList.add('fade-in');
        },
      })
    );

    this.owner.register(
      'template:components/sometimes-fades-in',
      hbs`
        {{#if shouldShow}}
          <div {{did-insert this.fadeIn}} class="alert">
            {{yield}}
          </div>
        {{/if}}
      `
    );

    await render(hbs`{{sometimes-fades-in shouldShow=true}}`);

    assert.dom('.alert').hasClass('fade-in');
  });
});

*/
