import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render, triggerEvent, settled, find } from '@ember/test-helpers';
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
    await settled();

    assert.equal(this.element.querySelectorAll('button.resizer').length, 8);

    this.set('directions', ['top', 'right']);

    assert.equal(this.element.querySelectorAll('button.resizer').length, 2);
    assert.ok(this.element.querySelector('button.resizer.top'));
    assert.notOk(this.element.querySelector('button.resizer.bottom'));
  });

  test('should react to width/height changes', async function(assert) {
    assert.expect(4);

    this.set('width', 100);
    this.set('height', 50);

    await render(hbs`<ReSizable @width={{this.width}} @height={{this.height}}>Hello</ReSizable>`);

    assert.equal(this.element.querySelector('.re-sizable').style.width, '100px');
    assert.equal(this.element.querySelector('.re-sizable').style.height, '50px');

    this.set('width', 150);
    this.set('height', 40);

    assert.equal(this.element.querySelector('.re-sizable').style.width, '150px');
    assert.equal(this.element.querySelector('.re-sizable').style.height, '40px');
  });

  test('should resize to input', async function(assert) {
    assert.expect(16);
    this.set('width', 200);
    this.set('height', 150);
    this.set('directions', DIRECTIONS);
    await render(
      hbs`<ReSizable @width={{this.width}} @height={{this.height}} @onResize={{this.onResize}} @directions={{this.directions}}>Hello</ReSizable>`
    );
    await settled();

    for (let i = 0; i < DIRECTIONS.length; ++i) {
      let direction = DIRECTIONS[i];

      this.set('width', 200);
      this.set('height', 150);
      // as the component resizes, capture the resulting dimensions as this.width and this.height
      this.set('onResize', (direction, dimensions) => this.setProperties(dimensions));

      await settled();
      let width = this.width;
      let height = this.height;

      await triggerEvent(`.resizer.${direction}`, 'mousedown', { clientX: 110, clientY: 40 });
      await triggerEvent(`.resizer.${direction}`, 'mousemove', { clientX: 160, clientY: 80 });
      await triggerEvent(`.resizer.${direction}`, 'mouseup', {});
      await settled();
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
      assert.dom('.re-sizable').hasStyle({ width: `${width}px` });
      assert.dom('.re-sizable').hasStyle({ height: `${height}px` });
    }
  });

  test('width should not exceed window dimensions', async function(assert) {
    this.set('width', 200);
    this.set('height', 150);
    let direction = 'left';
    this.set('directions', [direction]);
    this.set('maxWidth', 800);
    // as the component resizes, capture the resulting dimensions as this.width and this.height
    this.set('onResize', (direction, dimensions) => this.setProperties(dimensions));
    await render(
      hbs`<ReSizable @width={{this.width}} @height={{this.height}} @onResize={{this.onResize}} @directions={{this.directions}}>Hello</ReSizable>`
    );
    await settled();
    await triggerEvent(`.resizer.${direction}`, 'mousedown', { clientX: 110, clientY: 40 });
    await triggerEvent(`.resizer.${direction}`, 'mousemove', { clientX: 2000 });
    await triggerEvent(`.resizer.${direction}`, 'mouseup', {});
    let actualWidth = Number(find('.re-sizable').style.width.replace('px', ''));
    assert.ok(actualWidth < 800);
  });

  test('height should not exceed window dimensions', async function(assert) {
    this.set('width', 200);
    this.set('height', 150);
    let direction = 'top';
    this.set('directions', [direction]);
    this.set('maxWidth', 800);
    // as the component resizes, capture the resulting dimensions as this.width and this.height
    this.set('onResize', (direction, dimensions) => this.setProperties(dimensions));
    await render(
      hbs`<ReSizable @width={{this.width}} @height={{this.height}} @onResize={{this.onResize}} @directions={{this.directions}}>Hello</ReSizable>`
    );
    await settled();
    await triggerEvent(`.resizer.${direction}`, 'mousedown', { clientX: 110, clientY: 40 });
    await triggerEvent(`.resizer.${direction}`, 'mousemove', { clientY: 2000 });
    await triggerEvent(`.resizer.${direction}`, 'mouseup', {});
    let actualHeight = Number(find('.re-sizable').style.height.replace('px', ''));
    assert.ok(actualHeight < 800);
  });
});
