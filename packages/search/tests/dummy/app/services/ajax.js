import Service from '@ember/service';
import qs from 'qs';

const delay = 500;

const pokemon = [
  {
    id: 1,
    name: 'Bulbasaur',
  },
  {
    id: 25,
    name: 'Pikachu',
  },
];

export default Service.extend({
  request(path) {
    let query = path.match(/\?(.*)$/)[1];

    let queryString = qs.parse(query).q;

    let data = pokemon
      .filter(p => {
        if (queryString) {
          return p.name.toLowerCase().indexOf(queryString.toLowerCase()) > -1;
        }
        return true;
      })
      .map(p => {
        let attributes = Object.assign({}, p);
        delete attributes.id;
        return {
          type: 'pokemons',
          id: p.id,
          attributes,
        };
      });

    return new Promise(resolve => {
      setTimeout(resolve, delay);
    }).then(() => {
      return { data };
    });
  },
});
