import JSONAPIAdapter from 'ember-data/adapters/json-api';

export default JSONAPIAdapter.extend({
  host: 'http://localhost:3000',
  namespace: 'api',
});
