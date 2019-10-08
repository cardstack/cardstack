export default function() {
  this.namespace = 'api';
  this.resource('articles');
  this.resource('events');
  this.resource('people');
  this.resource('field-types');
}
