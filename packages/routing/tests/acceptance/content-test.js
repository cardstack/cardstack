import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | content');

test('renders own page content', function(assert) {
  visit('/beverages/soda');
  andThen(function() {
    assert.equal(currentURL(), '/beverages/soda');
    assert.equal(find('.beverage-title').text(), 'Coca Cola');
    assert.equal(find('.branch').text(), 'master');
  });
});

test('redirects for default content type', function(assert) {
  visit('/meals/burger');
  andThen(function() {
    assert.equal(currentURL(), '/burger');
    assert.equal(find('.meal-title').text(), 'Tasty Burger');
    assert.equal(find('.branch').text(), 'master');
  });
});

test('renders own page content on alternate branch', function(assert) {
  visit('/beverages/soda?branch=draft');
  andThen(function() {
    assert.equal(currentURL(), '/beverages/soda?branch=draft');
    assert.equal(find('.beverage-title').text(), 'Coca Cola');
    assert.equal(find('.branch').text(), 'draft');
  });
});

test('maintains branch when redirecting', function(assert) {
  visit('/meals/burger?branch=draft');
  andThen(function() {
    assert.equal(currentURL(), '/burger?branch=draft');
    assert.equal(find('.meal-title').text(), 'Tasty Burger');
    assert.equal(find('.branch').text(), 'draft');
  });
});
