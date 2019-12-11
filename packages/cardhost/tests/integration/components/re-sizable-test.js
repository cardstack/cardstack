import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, triggerEvent } from '@ember/test-helpers';
import hbs from 'htmlbars-inline-precompile';
import { dasherize } from '@ember/string';

const getSize = n => (!isNaN(parseFloat(n)) && isFinite(n) ? `${n}px` : n);

const DIRECTIONS = ['top', 'right', 'bottom', 'left', 'topRight', 'bottomRight', 'bottomLeft', 'topLeft'];

module('Integration | Component | re-sizable', function(hooks) {
  setupRenderingTest(hooks);

  test('should parse size', function(assert) {
    assert.equal(getSize(100), '100px');
    assert.equal(getSize('100'), '100px');
    assert.equal(getSize('100px'), '100px');
    assert.equal(getSize('100%'), '100%');
    assert.equal(getSize('auto'), 'auto');
  });

  test('should not render style attr when width/height unset', async function(assert) {
    assert.expect(1);

    await render(hbs`<ReSizable>Hello World</ReSizable>`);
    assert.equal(this.element.querySelector('div').getAttribute('style'), undefined);
  });

  test('should only render specified resizers', async function(assert) {
    assert.expect(4);

    this.set('directions', DIRECTIONS);

    await render(hbs`<ReSizable @directions={{this.directions}}>Hello</ReSizable>`);

    assert.equal(this.element.querySelectorAll('div.resizer').length, 8);

    this.set('directions', ['top', 'right']);

    assert.equal(this.element.querySelectorAll('div.resizer').length, 2);
    assert.ok(this.element.querySelector('div.resizer.top'));
    assert.notOk(this.element.querySelector('div.resizer.bottom'));
  });

  test('should react to width/height changes', async function(assert) {
    assert.expect(3);

    this.set('width', 100);
    this.set('height', 50);

    await render(hbs`<ReSizable @width={{this.width}} @height={{this.height}}>Hello</ReSizable>`);

    assert.equal(this.element.querySelector('div').style.width, '100px');
    assert.equal(this.element.querySelector('div').style.height, '50px');

    this.set('width', '150px');
    this.set('height', '20%');

    assert.equal(this.element.querySelector('div').getAttribute('style'), 'width: 150px;height: 20%;');
  });

  test('should resize to input', async function(assert) {
    assert.expect(16);

    this.set('width', 200);
    this.set('height', 150);

    this.set('onResize', (direction, dimensions) => this.setProperties(dimensions));

    await render(
      hbs`<ReSizable @width={{this.width}} @height={{this.height}} @onResize={{action onResize}}>Hello</ReSizable>`
    );

    for (let i = 0; i < DIRECTIONS.length; ++i) {
      let direction = DIRECTIONS[i];

      this.set('width', 200);
      this.set('height', 150);

      let width = this.width;
      let height = this.height;

      await triggerEvent(`div.${direction}`, 'mousedown', { clientX: 110, clientY: 40 });
      await triggerEvent(window, 'mousemove', { clientX: 160, clientY: 80 });
      await triggerEvent(window, 'mouseup', {});

      const dashDir = dasherize(direction);
      if (dashDir.includes('top')) {
        height -= 40;
      } else if (dashDir.includes('bottom')) {
        height += 40;
      }

      if (dashDir.includes('left')) {
        width -= 50;
      } else if (dashDir.includes('right')) {
        width += 50;
      }

      assert.equal(this.element.querySelector('div').style.width, `${width}px`);
      assert.equal(this.element.querySelector('div').style.height, `${height}px`);
    }
  });
});
