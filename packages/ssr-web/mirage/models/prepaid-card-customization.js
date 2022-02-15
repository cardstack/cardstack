import { Model, belongsTo } from 'ember-cli-mirage';

export default Model.extend({
  colorScheme: belongsTo('prepaid-card-color-scheme'),
  pattern: belongsTo('prepaid-card-pattern'),
});
