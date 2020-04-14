import Route from '@ember/routing/route';
import IMDB from '../../imdb';

export default class MovieRoute extends Route {
  model({ id }) {
    return IMDB.movies.filter(item => item.id === id)[0];
  }
}
