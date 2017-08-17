import { test } from 'qunit';
import moduleForAcceptance from '../../tests/helpers/module-for-acceptance';

moduleForAcceptance('Acceptance | content');

test('renders own page content', function(assert) {
  visit('/c/posts/1');
  andThen(function() {
    assert.equal(currentURL(), '/c/posts/1');
    assert.equal(find('.title').text(), 'hello world');
  });
});

test('redirects for default content type', function(assert) {
  visit('/c/pages/second');
  andThen(function() {
    assert.equal(currentURL(), '/c/second');
    assert.equal(find('.blurb').text(), 'I am the second page');
  });
});

test('redirects for singular content type', function(assert) {
  visit('/c/post/1');
  andThen(function() {
    assert.equal(currentURL(), '/c/posts/1');
  });
});

test('redirects for singular default content type', function(assert) {
  visit('/c/page/second');
  andThen(function() {
    assert.equal(currentURL(), '/c/second');
  });
});


test('renders placeholder type when content is missing', function(assert) {
  visit('/c/posts/bogus');
  andThen(function() {
    assert.equal(currentURL(), '/c/posts/bogus');
    assert.equal(find('h1:contains(Not Found)').length, 1);
  });
});
