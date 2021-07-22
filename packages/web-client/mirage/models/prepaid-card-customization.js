import { Model, belongsTo } from 'ember-cli-mirage';

export default Model.extend({
  prepaidCardColorScheme: belongsTo(),
  prepaidCardPattern: belongsTo(),
});
