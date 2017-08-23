import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | tools', {
  beforeEach() {
    delete localStorage['cardstack-tools'];
  },
  afterEach() {
    delete localStorage['cardstack-tools'];
  }
});


test('activate tools', function(assert) {
  visit('/1');
  click('.cardstack-tools-launcher');
  click('label:contains("Title")')
  andThen(function() {
    let matching = Array.from(find('input')).find(element => element.value === 'hello world');
    assert.ok(matching, 'found field editor for title');
  });
});
