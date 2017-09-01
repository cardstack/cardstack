import Ember from 'ember';

function assertTrimmedText(app, assert, selector, text, errorMessage) {
  let element = findWithAssert(selector);
  let elementText = element.text().trim();
  assert.equal(elementText, text, errorMessage);
}

Ember.Test.registerHelper('assertTrimmedText', assertTrimmedText);
