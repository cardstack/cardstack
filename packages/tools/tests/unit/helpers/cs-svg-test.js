import $ from 'jquery';
import { csSvg } from 'dummy/helpers/cs-svg';
import { module, test } from 'qunit';

module('Unit | Helper | cs svg', function() {
  test('it works', function(assert) {
    let result = csSvg(['my-icon'], { width: '26px', class: 'foo' });
    assert.equal(
      $(result.toHTML())
        .children('use')
        .attr('xlink:href'),
      '#my-icon',
    );
  });
});
