export default function() {
  this.namespace = 'api';
  this.get('/articles');
  this.get('/events');
}
