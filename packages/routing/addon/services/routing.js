import Service from '@ember/service';
import { pluralize, singularize } from 'ember-inflector';

export default Service.extend({
  routeFor(path) {
    return {
      name: 'cardstack.content',
      params: [ ['path', path] ],
    };
  },

  routeForNew(type) {
    type = pluralize(type);
    return {
      name: 'cardstack.new-content',
      params: [ ['type', type] ],
    }
  },

  modelType(type) {
    return singularize(type);
  }

});
