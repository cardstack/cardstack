import { assign } from '@ember/polyfills';
import JSONAPIAdapter from 'ember-data/adapters/json-api';
import RSVP from 'rsvp';

const delay = 500;

const pokemon = [
  {
    id: 1,
    name: 'Bulbasaur'
  },
  {
    id: 2,
    name: 'Pikachu'
  }
];

export default JSONAPIAdapter.extend({
  query(store, type, query) {
    let data = pokemon.filter(p => {
      if (query.queryString) {
        return p.name.toLowerCase().indexOf(query.queryString.toLowerCase()) > -1;
      }
      return true;
    }).map(p => {
      let attributes = assign({}, p);
      delete attributes.id;
      return {
        type: 'pokemons',
        id: p.id,
        attributes
      };
    });
    return new RSVP.Promise(resolve => {
      setTimeout(resolve, delay);
    }).then(() => {
      return { data };
    });
  }
});
